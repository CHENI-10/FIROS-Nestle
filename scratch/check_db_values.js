const db = require('./backend/src/config/db');

async function checkValues() {
    try {
        const res = await db.query('SELECT DISTINCT shelf_availability FROM report_line_items');
        console.log('Unique shelf_availability values:', res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkValues();
