const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const demoBatches = [
    'MILO-400-2026-0031',
    'MILO-400-2026-0032',
    'MAGGI-CUR-2026-0007',
    'NEST-400-2026-0019',
    'MGCP-150-2026-0004',
    'NESP-400-2026-0003',
    'MLKM-400-2026-0008',
    'NESP-800-2026-0001',
    'CERL-WHT-2026-0022',
    'NANG-400-2026-0011',
    'LACT-400-2025-0002',
    'NICD-180-2026-0005'
];

async function resetDemoBatches() {
    try {
        console.log('Restoring 12 demo batches to in_storage status...');
        
        // 1. Delete from dispatch_records
        await pool.query('DELETE FROM dispatch_records WHERE batch_id = ANY($1)', [demoBatches]);
        
        // 2. Delete from clearance_records
        await pool.query('DELETE FROM clearance_records WHERE batch_id = ANY($1)', [demoBatches]);
        
        // 3. Delete from return_records
        await pool.query('DELETE FROM return_records WHERE batch_id = ANY($1)', [demoBatches]);
        
        // 4. Update status back to in_storage
        const res = await pool.query(`UPDATE batches SET status = 'in_storage' WHERE batch_id = ANY($1) RETURNING batch_id`, [demoBatches]);
        
        console.log(`Successfully restored ${res.rowCount} demo batches back to storage!`);
    } catch(err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

resetDemoBatches();
