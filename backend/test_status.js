const pool = require('./src/config/db');

async function test() {
    const res = await pool.query("SELECT status FROM batches WHERE batch_id = 'MILO-400-2026-0039'");
    console.log(res.rows);
    process.exit();
}

test();
