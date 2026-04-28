require('dotenv').config({path: '../.env'});
const pool = require('./config/db');
const bcrypt = require('bcrypt');

async function addReps() {
  try {
    const passwordHash1 = await bcrypt.hash('Rep123!', 12);
    const passwordHash2 = await bcrypt.hash('Rep123!', 12);

    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES 
      ('Nishal', 'nishalrep@nestle.lk', $1, 'sales_rep'),
      ('Samantha', 'samantharep@nestle.lk', $2, 'sales_rep')`,
      [passwordHash1, passwordHash2]
    );
    console.log("Successfully added Nishal and Samantha!");
  } catch (err) {
    if (err.code === '23505') {
        console.log("Users already exist in the database.");
    } else {
        console.error("Error adding reps:", err);
    }
  } finally {
    pool.end();
  }
}

addReps();
