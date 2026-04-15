const pool = require('./src/config/db');

pool.query(`
    ALTER TABLE return_records 
    ADD COLUMN system_recommendation VARCHAR(10) CHECK (system_recommendation IN ('accept', 'review', 'reject')), 
    ADD COLUMN override_reason TEXT;
`).then(() => {
    console.log('Migration successful.');
    process.exit(0);
}).catch(e => {
    console.error('Migration failed:', e.message);
    process.exit(1);
});
