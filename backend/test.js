const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.query("INSERT INTO users (full_name, email, password_hash, role) VALUES ('Admin2', 'admin@nestle.lk', '123', 'admin') ON CONFLICT DO NOTHING;")
  .then(res => console.log('Works!'))
  .catch(e => console.log('Error:', e.message))
  .finally(() => pool.end());
