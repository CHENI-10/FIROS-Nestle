const pool = require('./src/config/db');

pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'return_records'")
    .then(r => {
        console.log(r.rows);
        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
