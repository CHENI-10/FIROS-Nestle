const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_SbauiHRg80Dz@ep-lucky-grass-adnfa06f-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function fixBreachCounts() {
    try {
        console.log('Fetching all stored batches...');
        const batches = await pool.query(`
            SELECT b.batch_id, b.zone_id, p.max_safe_temp, p.max_safe_humidity, b.arrival_timestamp
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            WHERE b.status = 'in_storage'
        `);

        for (const batch of batches.rows) {
            console.log(`Processing batch ${batch.batch_id}...`);

            // Count actual temperature breaches from logs
            const tempRes = await pool.query(`
                SELECT COUNT(*) as count FROM environmental_logs 
                WHERE zone_id = $1 AND logged_at >= $2 AND temperature > $3
            `, [batch.zone_id, batch.arrival_timestamp, batch.max_safe_temp]);

            // Count actual humidity breaches from logs
            const humidRes = await pool.query(`
                SELECT COUNT(*) as count FROM environmental_logs 
                WHERE zone_id = $1 AND logged_at >= $2 AND humidity > $3 AND $1 != 'D'
            `, [batch.zone_id, batch.arrival_timestamp, batch.max_safe_humidity]);

            const actualTemp = parseInt(tempRes.rows[0].count);
            const actualHumid = parseInt(humidRes.rows[0].count);

            // Update the freshness_scores table to match the reality of the logs
            await pool.query(`
                UPDATE freshness_scores 
                SET total_temp_breach_windows = $1, 
                    total_humidity_breach_windows = $2 
                WHERE batch_id = $3
            `, [actualTemp, actualHumid, batch.batch_id]);

            console.log(`✓ Updated ${batch.batch_id}: Temp=${actualTemp}, Humid=${actualHumid}`);
        }

        console.log('\nAll breach counts have been synchronized with the historical logs.');
    } catch (err) {
        console.error('Error during synchronization:', err);
    } finally {
        await pool.end();
    }
}

fixBreachCounts();
