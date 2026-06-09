const { Pool } = require('pg');
require('dotenv').config();
const { recalculateAllBatches } = require('./src/services/frsService');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixMediumRisk() {
    try {
        await pool.query(`UPDATE freshness_scores SET total_temp_breach_windows = 15 WHERE batch_id IN ('MLK-MD-3452-3453-223', 'MLKMD-203637')`);
        await pool.query(`UPDATE freshness_scores SET total_temp_breach_windows = 15 WHERE batch_id = 'MILO-400-2026-0031'`);
        await recalculateAllBatches(pool);
        console.log('Medium risk batches fixed!');
    } finally {
        pool.end();
    }
}

fixMediumRisk();
