const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(verifyToken);

// ROUTE 1: GET /
// Returns complete dashboard data in one call
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                b.batch_id,
                b.zone_id,
                b.quantity,
                b.manufacturing_date,
                b.expiry_date,
                b.arrival_timestamp,
                b.status,
                p.product_name,
                p.pack_size,
                p.temp_sensitivity_weight,
                p.humidity_sensitivity_weight,
                fs.frs_score,
                fs.risk_band,
                fs.days_in_warehouse,
                fs.slr_percent_raw,
                fs.total_temp_breach_windows,
                fs.total_humidity_breach_windows,
                fs.last_calculated_at
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.status = 'in_storage'
            ORDER BY fs.frs_score ASC
        `;
        
        const result = await pool.query(query);
        const batches = result.rows;

        let totalFrs = 0;
        let frsCount = 0;
        let high_risk_count = 0;
        let medium_risk_count = 0;
        let low_risk_count = 0;

        batches.forEach(batch => {
            if (batch.frs_score !== null && batch.frs_score !== undefined) {
                totalFrs += Number(batch.frs_score);
                frsCount++;
            }
            if (batch.risk_band === 'high') high_risk_count++;
            if (batch.risk_band === 'medium') medium_risk_count++;
            if (batch.risk_band === 'low') low_risk_count++;
        });

        const overall_freshness_percent = frsCount > 0 ? Math.round(totalFrs / frsCount) : 0;
        const total_batches = batches.length;

        // Return complete dashboard data
        res.json({
            batches,
            overall_freshness_percent,
            total_batches,
            high_risk_count,
            medium_risk_count,
            low_risk_count
        });
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).json({ error: 'Server error fetching dashboard data' });
    }
});

// ROUTE 2: GET /zones
// Returns staleness status for all 4 zones
router.get('/zones', async (req, res) => {
    try {
        const query = `
            SELECT zone_id, zone_name, last_reading_at
            FROM warehouse_zones
            ORDER BY zone_id
        `;
        const result = await pool.query(query);
        
        const zones = result.rows.map(zone => {
            let minutes_since_reading = null;
            let is_stale = true;
            
            if (zone.last_reading_at) {
                const lastReadingDate = new Date(zone.last_reading_at);
                const diffMs = Date.now() - lastReadingDate.getTime();
                minutes_since_reading = Math.floor(diffMs / (1000 * 60));
                
                // Stale if reading is more than 60 minutes ago
                is_stale = minutes_since_reading > 60;
            }
            
            return {
                ...zone,
                is_stale,
                minutes_since_reading
            };
        });

        res.json(zones);
    } catch (err) {
        console.error('Error fetching zones data:', err);
        res.status(500).json({ error: 'Server error fetching zones data' });
    }
});

// ROUTE 3: GET /alerts
// Returns all unread alerts ordered by newest first
router.get('/alerts', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.alert_id,
                a.batch_id,
                a.alert_type,
                a.risk_band,
                a.message,
                a.is_read,
                a.created_at,
                p.product_name,
                b.zone_id
            FROM alert_records a
            JOIN batches b ON a.batch_id = b.batch_id
            JOIN products p ON b.product_id = p.product_id
            WHERE a.is_read = false
            ORDER BY a.created_at DESC
            LIMIT 20
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching alerts:', err);
        res.status(500).json({ error: 'Server error fetching alerts' });
    }
});

// ROUTE 4: GET /expiry-timeline
// Returns batches expiring within 30 days
router.get('/expiry-timeline', async (req, res) => {
    try {
        const query = `
            SELECT
                b.batch_id,
                b.expiry_date,
                b.zone_id,
                p.product_name,
                p.pack_size,
                fs.frs_score,
                fs.risk_band,
                EXTRACT(DAY FROM (b.expiry_date - CURRENT_DATE)) as days_until_expiry
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.status = 'in_storage'
            AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
            ORDER BY b.expiry_date ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching expiry timeline:', err);
        res.status(500).json({ error: 'Server error fetching expiry timeline' });
    }
});

// ROUTE 5: GET /recommendations
// Returns intelligent dispatch recommendations based on FRS risk bands
router.get('/recommendations', async (req, res) => {
    try {
        const query = `
            SELECT 
                b.batch_id,
                b.zone_id,
                b.expiry_date,
                b.arrival_timestamp,
                b.quantity,
                p.product_name,
                p.pack_size,
                fs.frs_score,
                fs.risk_band,
                fs.days_in_warehouse,
                fs.total_temp_breach_windows,
                fs.total_humidity_breach_windows
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.status = 'in_storage'
            ORDER BY fs.frs_score ASC
        `;
        
        const result = await pool.query(query);
        const batches = result.rows;

        const high_risk = [];
        const medium_risk = [];
        const low_risk = [];

        batches.forEach(batch => {
            const risk_band = batch.risk_band;
            let recommendationObj = { ...batch };

            if (risk_band === 'high') {
                recommendationObj.action = 'CLEARANCE';
                recommendationObj.priority = 1;
                recommendationObj.recommendation = 'Remove from dispatch queue. Recommend 20% trade discount to fastest distributor or bundle with healthy-FRS product. Manager must approve clearance.';
                recommendationObj.badge_color = 'red';
                recommendationObj.badge_text = 'HIGH RISK — CLEARANCE';
                high_risk.push(recommendationObj);
            } else if (risk_band === 'medium') {
                recommendationObj.action = 'PRIORITY_DISPATCH';
                recommendationObj.priority = 2;
                recommendationObj.recommendation = 'Priority dispatch recommended. Move to top of dispatch queue. Assign to fastest available distributor. Manager must approve dispatch.';
                recommendationObj.badge_color = 'amber';
                recommendationObj.badge_text = 'MEDIUM RISK — PRIORITY DISPATCH';
                medium_risk.push(recommendationObj);
            } else if (risk_band === 'low') {
                recommendationObj.action = 'NORMAL_DISPATCH';
                recommendationObj.priority = 3;
                recommendationObj.recommendation = 'Normal FEFO dispatch. Batch is in good condition. Include in standard dispatch queue ordered by expiry date.';
                recommendationObj.badge_color = 'green';
                recommendationObj.badge_text = 'LOW RISK — NORMAL DISPATCH';
                low_risk.push(recommendationObj);
            }
        });

        // Sort Medium Risk batches by expiry_date ASC first
        medium_risk.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
        
        // Then Low Risk batches by expiry_date ASC
        low_risk.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

        // dispatch_queue: medium risk + low risk combined, medium first then low
        const dispatch_queue = [...medium_risk, ...low_risk];

        res.json({
            high_risk,
            medium_risk,
            low_risk,
            dispatch_queue,
            total_in_queue: dispatch_queue.length,
            total_clearance: high_risk.length
        });
    } catch (err) {
        console.error('Error fetching recommendations:', err);
        res.status(500).json({ error: 'Server error fetching recommendations' });
    }
});

module.exports = router;
