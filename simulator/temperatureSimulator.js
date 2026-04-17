require('dotenv').config();
const cron = require('node-cron');
const pool = require('./db');
const zones = require('./zonesConfig');

// Utility function to generate random values
const generateRandom = (min, max) => {
  return parseFloat((Math.random() * (max - min) + min).toFixed(1));
};

// Calculate FRS and Risk Band
const calculateFRS = (batch, totalTempBreaches, totalHumidityBreaches) => {
  const now = new Date();
  const arrivalDate = new Date(batch.arrival_timestamp);
  const expiryDate = new Date(batch.expiry_date);
  
  const daysInWarehouse = Math.floor((now - arrivalDate) / 86400000);
  
  // Assuming shelf_life_months is available on the batch/product
  const shelfLifeMonths = batch.shelf_life_months || 12; // Default fallback
  const totalShelfLifeDays = shelfLifeMonths * 30.44;
  
  const slrPercentRaw = ((expiryDate - now) / (totalShelfLifeDays * 86400000)) * 100 * 86400000; // Simplified to just days ratio
  // wait, the formula is: ((expiry_date - today) / total_shelf_life_days) * 100
  const daysToExpiry = (expiryDate - now) / 86400000;
  const slrPercentRawCorrected = (daysToExpiry / totalShelfLifeDays) * 100;

  // Extract sensitivity weights
  const tempWeight = batch.temp_sensitivity_weight || 1; // Fallbacks if not provided
  let humidityWeight = batch.humidity_sensitivity_weight || 1;
  
  // Zone D: humidity_sensitivity_weight = 0
  if (batch.zone_id === 'D') {
    humidityWeight = 0;
  }

  const frs = Math.max(0, Math.round(
    slrPercentRawCorrected
    - (Math.floor(daysInWarehouse) * 0.10) // Reduced from 0.25 to 0.10
    - (totalTempBreaches * (Math.abs(tempWeight) * 0.5)) // Halved from 1.0x to 0.5x
    - (totalHumidityBreaches * (Math.abs(humidityWeight) * 0.5)) // Halved from 1.0x to 0.5x
    - Math.max(Math.abs(tempWeight), Math.abs(humidityWeight))
  ));

  let riskBand = 'high';
  if (frs >= 80) riskBand = 'low';
  else if (frs >= 60) riskBand = 'medium';

  return { frs, riskBand, slrPercentRawCorrected, daysInWarehouse };
};

// Main simulation function
const runSimulation = async () => {
  console.log(`\n--- Starting Simulation Cycle at ${new Date().toISOString()} ---`);
  const client = await pool.connect();

  try {
    for (const zone of zones) {
      try {
      // STEP 1 - Generate readings
      const temperature = generateRandom(zone.tempMin, zone.tempMax);
      const humidity = zone.id === 'D' ? null : generateRandom(zone.humidityMin, zone.humidityMax);

      let batchesChecked = 0;
      let breachesFound = 0;

      // STEP 2 - Save to environmental_logs table
      await client.query(
        `INSERT INTO environmental_logs (zone_id, temperature, humidity, logged_at) VALUES ($1, $2, $3, NOW())`,
        [zone.id, temperature, humidity]
      );

      // Attempt to update warehouse_zones if it exists (ignoring errors if table doesn't exist yet for resilience)
      try {
        await client.query(
          `UPDATE warehouse_zones SET last_reading_at = NOW() WHERE zone_id = $1`,
          [zone.id]
        );
      } catch (e) {
        // Table might not exist, silently ignore
      }

      // STEP 3 - Check for breaches per zone
      const batchesResult = await client.query(`
        SELECT b.*, p.product_name, p.max_safe_temp, p.max_safe_humidity, p.shelf_life_months,
               p.temp_sensitivity_weight, p.humidity_sensitivity_weight,
               fs.total_temp_breach_windows, fs.total_humidity_breach_windows,
               fs.frs_score, fs.risk_band as current_risk_band
        FROM batches b
        JOIN products p ON b.product_id = p.product_id
        LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
        WHERE b.zone_id = $1 AND b.status = 'in_storage'
      `, [zone.id]);
      
      const batches = batchesResult.rows;
      batchesChecked = batches.length;

      for (const batch of batches) {
        let isTempBreach = temperature > batch.max_safe_temp;
        let isHumidityBreach = zone.id !== 'D' && humidity !== null && humidity > batch.max_safe_humidity;

        let totalTempBreaches = batch.total_temp_breach_windows || 0;
        let totalHumidBreaches = batch.total_humidity_breach_windows || 0;

        // STEP 4 - If breach detected
        if (isTempBreach || isHumidityBreach) {
          breachesFound++;
          
          if (isTempBreach) totalTempBreaches++;
          if (isHumidityBreach) totalHumidBreaches++;

          // Recalculate FRS
          const { frs, riskBand, slrPercentRawCorrected, daysInWarehouse } = calculateFRS(batch, totalTempBreaches, totalHumidBreaches);

          // Update freshness_scores
          await client.query(`
            INSERT INTO freshness_scores 
              (batch_id, frs_score, risk_band, slr_percent_raw, days_in_warehouse, total_temp_breach_windows, total_humidity_breach_windows, last_calculated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (batch_id) DO UPDATE SET
              frs_score = $2,
              risk_band = $3,
              slr_percent_raw = $4,
              days_in_warehouse = $5,
              total_temp_breach_windows = $6,
              total_humidity_breach_windows = $7,
              last_calculated_at = NOW()
          `, [batch.batch_id, frs, riskBand, slrPercentRawCorrected, daysInWarehouse, totalTempBreaches, totalHumidBreaches]);

          // STEP 5 & 6 - Alert deduplication & insertion
          const prevRiskBand = batch.current_risk_band || 'low';
          let shouldAlert = false;
          let alertType = '';
          let message = '';

          if (zone.id === 'C') {
             shouldAlert = true;
             alertType = 'zone_c_breach';
             message = `${batch.product_name || 'Product'} \u2014 ${batch.batch_id} (Zone ${zone.id}): ${frs} score. ${riskBand.toUpperCase()} RISK LEVEL. Action required immediately.`;
          } else if (riskBand !== prevRiskBand && (riskBand === 'medium' || riskBand === 'high')) {
            // Check if alert already exists
            const alertCheck = await client.query(`
              SELECT alert_id FROM alert_records WHERE batch_id = $1 AND risk_band = $2 ORDER BY created_at DESC LIMIT 1
            `, [batch.batch_id, riskBand]);

            if (alertCheck.rowCount === 0) {
              shouldAlert = true;
              alertType = riskBand === 'high' ? 'high_risk_crossing' : 'medium_risk_crossing';
              message = `${batch.product_name || 'Product'} \u2014 ${batch.batch_id} (Zone ${zone.id}): ${frs} score. ${riskBand.toUpperCase()} RISK LEVEL. Action required.`;
            }
          }

          if (shouldAlert) {
            await client.query(`
              INSERT INTO alert_records (batch_id, alert_type, risk_band, message, is_read)
              VALUES ($1, $2, $3, $4, false)
            `, [batch.batch_id, alertType, riskBand, message]);
          }
        }
      }

      console.log(`[${new Date().toISOString()}] Zone ${zone.id}: ${temperature}°C, ${humidity !== null ? humidity + '%' : 'N/A'} | ${batchesChecked} batches checked | ${breachesFound} breaches found`);
      } catch (zoneError) {
        console.error(`Error during simulation cycle for Zone ${zone.id}:`, zoneError);
        // Continue to the next zone
      }
    }

    // Expiry proximity check
    const expiryCheckQuery = `
      SELECT b.batch_id, b.zone_id, p.product_name, b.expiry_date, fs.frs_score
      FROM batches b
      JOIN products p ON b.product_id = p.product_id
      LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
      WHERE b.status = 'in_storage' 
        AND b.expiry_date <= NOW() + INTERVAL '60 days'
    `;
    try {
      const expiryBatches = await client.query(expiryCheckQuery);

      for (const batch of expiryBatches.rows) {
        const daysToExpiry = Math.ceil((new Date(batch.expiry_date) - new Date()) / 86400000);
        
        const alertCheck = await client.query(`
          SELECT alert_id FROM alert_records WHERE batch_id = $1 AND alert_type = 'expiry_proximity'
        `, [batch.batch_id]);

        if (alertCheck.rowCount === 0) {
          const message = `${batch.product_name || 'Product'} \u2014 ${batch.batch_id} (Zone ${batch.zone_id}): Expiry in ${daysToExpiry} days. ${batch.frs_score || 'N/A'} score. Urgent dispatch.`;
          await client.query(`
            INSERT INTO alert_records (batch_id, alert_type, risk_band, message, is_read)
            VALUES ($1, 'expiry_proximity', 'high', $2, false)
          `, [batch.batch_id, message]);
        }
      }
    } catch (expiryError) {
      console.error('Error during expiry check cycle:', expiryError);
    }
  } catch (error) {
    console.error('Fatal error setting up simulation cycle:', error);
  } finally {
    client.release();
  }
};

// Run immediately on startup
runSimulation();

// Schedule to run every 30 minutes
cron.schedule('*/30 * * * *', runSimulation);

console.log('FIROS Temperature Simulator started. Running every 30 minutes.');

// Minimal HTTP server so Render doesn't kill the process (port scan requirement)
const http = require('http');
const PORT = process.env.PORT || 3001;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', message: 'FIROS Simulator is running.' }));
}).listen(PORT, () => {
  console.log(`Health-check server listening on port ${PORT}`);
});
