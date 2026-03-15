const pool = require('../config/db');
require('dotenv').config();

/**
 * calculateFRS
 * 
 * @param {Object} batchData { batch_id, arrival_timestamp, expiry_date, zone_id }
 * @param {Object} productData { shelf_life_months, temp_sensitivity_weight, humidity_sensitivity_weight }
 * @param {Object} scoreData { total_temp_breach_windows, total_humidity_breach_windows }
 */
const calculateFRS = (batchData, productData, scoreData) => {
    const { arrival_timestamp, expiry_date, zone_id } = batchData;
    const { shelf_life_months, temp_sensitivity_weight, humidity_sensitivity_weight } = productData;
    const { total_temp_breach_windows, total_humidity_breach_windows } = scoreData;

    const today = Date.now();
    const expiry = new Date(expiry_date).getTime();
    const arrival = new Date(arrival_timestamp).getTime();
    
    // 1. slr_percent_raw:
    const total_shelf_life_days = shelf_life_months * 30.44;
    const days_to_expiry_ms = expiry - today;
    const days_to_expiry = days_to_expiry_ms / 86400000;
    const slr_percent_raw = (days_to_expiry / total_shelf_life_days) * 100;

    // 2. days_in_warehouse:
    // Must use Math.floor() — a batch 23 hours old = 0 days
    const days_in_warehouse = Math.floor((today - arrival) / 86400000);

    // 3. total_temp_breach_penalty (TBP):
    const total_temp_breach_penalty = total_temp_breach_windows * Math.abs(temp_sensitivity_weight);

    // 4. total_humidity_breach_penalty (HBP):
    // Zone D: humidity_sensitivity_weight = 0, so HBP = 0 always
    const effective_humidity_weight = zone_id === 'D' ? 0 : humidity_sensitivity_weight;
    const total_humidity_breach_penalty = total_humidity_breach_windows * Math.abs(effective_humidity_weight);

    // 5. sensitivity_adjustment (SA):
    // Zone D: SA = Math.abs(temp_sensitivity_weight) only (humidity_weight = 0)
    const sensitivity_adjustment = Math.max(
        Math.abs(temp_sensitivity_weight), 
        Math.abs(effective_humidity_weight)
    );

    // The Exact FRS Formula:
    const frs_score = Math.max(0, Math.round(
        slr_percent_raw
        - (Math.floor(days_in_warehouse) * 0.25)
        - total_temp_breach_penalty
        - total_humidity_breach_penalty
        - sensitivity_adjustment
    ));

    // 6. risk_band:
    let risk_band;
    if (frs_score >= 80) {
        risk_band = 'low';
    } else if (frs_score >= 60) {
        risk_band = 'medium';
    } else {
        risk_band = 'high';
    }

    return {
        frs_score,
        risk_band,
        slr_percent_raw,
        days_in_warehouse
    };
};

/**
 * recalculateBatchFRS
 * 
 * @param {Object} dbPool 
 * @param {string} batch_id 
 */
const recalculateBatchFRS = async (dbPool, batch_id) => {
    // Fetches batch, product and score data from database
    const batchRes = await dbPool.query(
        `SELECT batch_id, arrival_timestamp, expiry_date, zone_id, product_id FROM batches WHERE batch_id = $1`, 
        [batch_id]
    );
    if (batchRes.rows.length === 0) throw new Error('Batch not found');
    const batchData = batchRes.rows[0];

    const productRes = await dbPool.query(
        `SELECT shelf_life_months, temp_sensitivity_weight, humidity_sensitivity_weight FROM products WHERE product_id = $1`, 
        [batchData.product_id]
    );
    if (productRes.rows.length === 0) throw new Error('Product not found');
    const productData = productRes.rows[0];

    const scoreRes = await dbPool.query(
        `SELECT total_temp_breach_windows, total_humidity_breach_windows FROM freshness_scores WHERE batch_id = $1`, 
        [batch_id]
    );
    const scoreData = scoreRes.rows.length > 0 ? scoreRes.rows[0] : { total_temp_breach_windows: 0, total_humidity_breach_windows: 0 };

    // Calls calculateFRS()
    const result = calculateFRS(batchData, productData, scoreData);

    // Updates freshness_scores table
    await dbPool.query(`
        UPDATE freshness_scores SET
            frs_score = $1,
            risk_band = $2,
            slr_percent_raw = $3,
            days_in_warehouse = $4,
            last_calculated_at = NOW()
        WHERE batch_id = $5
    `, [result.frs_score, result.risk_band, result.slr_percent_raw, result.days_in_warehouse, batch_id]);

    // Returns updated score object
    return {
        batch_id,
        ...result,
        total_temp_breach_windows: scoreData.total_temp_breach_windows,
        total_humidity_breach_windows: scoreData.total_humidity_breach_windows
    };
};

/**
 * recalculateAllBatches
 * 
 * @param {Object} dbPool 
 */
const recalculateAllBatches = async (dbPool) => {
    // Gets all batches with status = 'in_storage'
    const batchesRes = await dbPool.query(`SELECT batch_id FROM batches WHERE status = 'in_storage'`);
    const results = [];
    
    // Calls recalculateBatchFRS() for each one
    for (let row of batchesRes.rows) {
        try {
            const result = await recalculateBatchFRS(dbPool, row.batch_id);
            results.push(result);
        } catch (error) {
            console.error(`Error recalculating FRS for batch ${row.batch_id}:`, error.message);
        }
    }

    // Logs
    console.log(`FRS recalculated for ${results.length} batches`);
    
    // Returns array of updated scores
    return results;
};

module.exports = {
    calculateFRS,
    recalculateBatchFRS,
    recalculateAllBatches
};
