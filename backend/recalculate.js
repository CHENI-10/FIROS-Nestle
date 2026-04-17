const pool = require('./src/config/db');
const { recalculateAllBatches } = require('./src/services/frsService');

async function run() {
    try {
        console.log('Starting FRS recalculation for all batches using the new slower-decay logic...');
        const results = await recalculateAllBatches(pool);
        
        console.log('\n--- Sample of Updated Scores ---');
        // Let's print the first 5 records to see the results
        results.slice(0, 5).forEach(res => {
            console.log(`Batch ${res.batch_id}: FRS = ${res.frs_score}, Band = ${res.risk_band}`);
        });
        
    } catch (err) {
        console.error('Failed to recalculate batches:', err);
    } finally {
        await pool.end();
    }
}

run();
