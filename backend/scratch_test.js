const { Pool } = require('./src/config/db');
const pool = new Pool();

async function run() {
    try {
        const query = `
            SELECT 
                rr.batch_id, 
                fs.days_in_warehouse, 
                fs.total_temp_breach_windows, 
                dr.dispatch_timestamp, 
                dr.collected_timestamp 
            FROM return_records rr 
            LEFT JOIN freshness_scores fs ON rr.batch_id = fs.batch_id 
            LEFT JOIN dispatch_records dr ON rr.batch_id = dr.batch_id
        `;
        const res = await pool.query(query);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();
