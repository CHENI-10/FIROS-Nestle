const pool = require('./src/config/db');
pool.query("SELECT b.batch_id, b.manufacturing_date, fs.days_in_warehouse, fs.last_calculated_at, rr.created_at FROM batches b LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id LEFT JOIN return_records rr ON b.batch_id = rr.batch_id WHERE b.batch_id = 'MGCP-150-2026-0004'")
  .then(res => { console.table(res.rows); process.exit(); })
  .catch(err => { console.error(err); process.exit(1); });
