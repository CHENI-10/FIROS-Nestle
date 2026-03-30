const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_SbauiHRg80Dz@ep-lucky-grass-adnfa06f-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function runCheck() {
    try {
        const res = await pool.query(`
            SELECT 
                f.batch_id, 
                f.total_temp_breach_windows as stored_temp, 
                f.total_humidity_breach_windows as stored_humid,
                (SELECT COUNT(*) FROM environmental_logs el WHERE el.zone_id = b.zone_id AND el.logged_at >= b.arrival_timestamp AND el.temperature > p.max_safe_temp) as calc_temp,
                (SELECT COUNT(*) FROM environmental_logs el WHERE el.zone_id = b.zone_id AND el.logged_at >= b.arrival_timestamp AND el.humidity > p.max_safe_humidity AND b.zone_id != 'D') as calc_humid
            FROM freshness_scores f 
            JOIN batches b ON f.batch_id = b.batch_id 
            JOIN products p ON b.product_id = p.product_id 
            LIMIT 10
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

runCheck();
