const pool = require('./backend/src/config/db');

async function debugReturns() {
    try {
        const start = '2026-04-01T00:00:00.000Z';
        const end = '2026-04-30T23:59:59.999Z';
        
        console.log(`Checking return_records for April 2026...`);
        const res = await pool.query(`
            SELECT rr.return_id, rr.batch_id, rr.decided_at, rr.decision, rr.created_at
            FROM return_records rr
            WHERE (rr.decided_at >= $1 AND rr.decided_at <= $2)
               OR (rr.created_at >= $1 AND rr.created_at <= $2)
        `, [start, end]);
        
        console.log(`Found ${res.rows.length} total return records in April.`);
        res.rows.forEach(r => {
            console.log(`ID: ${r.return_id}, Batch: ${r.batch_id}, Created: ${r.created_at}, Decided: ${r.decided_at}, Decision: ${r.decision}`);
        });
        
        const joinsCheck = await pool.query(`
            SELECT rr.return_id
            FROM return_records rr
            LEFT JOIN batches b ON rr.batch_id = b.batch_id
            LEFT JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            LEFT JOIN distributor_records d ON rr.distributor_id = d.distributor_id
            WHERE (rr.decided_at >= $1 AND rr.decided_at <= $2)
            AND (b.batch_id IS NULL OR p.product_id IS NULL OR fs.batch_id IS NULL OR d.distributor_id IS NULL)
        `, [start, end]);
        
        if (joinsCheck.rows.length > 0) {
            console.log(`WARNING: Found ${joinsCheck.rows.length} records with missing join data (Batch, Product, Score, or Distributor).`);
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugReturns();
