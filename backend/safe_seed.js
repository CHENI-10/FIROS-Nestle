const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const safeSeedDatabase = async () => {
    try {
        console.log('Reading schema.sql...');
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Strip SQL single-line comments (-- ...) and multi-line comments
        const cleanSchema = schema.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Extract only INSERT INTO statements
        const insertStatements = cleanSchema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.toUpperCase().startsWith('INSERT INTO'));

        console.log(`Found ${insertStatements.length} INSERT blocks. Attempting safe merge per row...`);

        let successCount = 0;

        for (let i = 0; i < insertStatements.length; i++) {
            try {
                // Append ON CONFLICT DO NOTHING to ensure multi-row inserts skip only duplicates
                const safeQuery = insertStatements[i] + ' ON CONFLICT DO NOTHING;';
                await pool.query(safeQuery);
                successCount++;
            } catch (err) {
                console.warn(`[Warning] Query ${i} failed with error:`, err.message);
            }
        }

        console.log(`✅ Safe merge complete!`);
        console.log(`Successfully merged demo data blocks: ${successCount} out of ${insertStatements.length}`);

    } catch (error) {
        console.error('❌ Error in safe seed:', error);
    } finally {
        await pool.end();
    }
};

safeSeedDatabase();
