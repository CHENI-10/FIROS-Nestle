const db = require('../config/db');

const registerBatch = async (req, res) => {
    const { ean13_barcode, batch_id, quantity, manufacturing_date, zone_id } = req.body;

    try {
        await db.query('BEGIN');

        // Check if batch already exists
        const checkBatchQuery = 'SELECT * FROM batches WHERE batch_id = $1';
        const { rows: existingBatches } = await db.query(checkBatchQuery, [batch_id]);

        if (existingBatches.length > 0) {
            await db.query('ROLLBACK');
            return res.status(200).json(existingBatches[0]);
        }

        // Look up product by ean13_barcode
        const productQuery = 'SELECT * FROM products WHERE ean13_barcode = $1';
        const { rows: products } = await db.query(productQuery, [ean13_barcode]);

        if (products.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Product not found' });
        }

        const product = products[0];

        // Calculate expiry_date
        const mfgDate = new Date(manufacturing_date);
        const expiryDate = new Date(mfgDate.setMonth(mfgDate.getMonth() + product.shelf_life_months));

        // Insert into batches table
        const insertBatchQuery = `
            INSERT INTO batches (batch_id, ean13_barcode, quantity, manufacturing_date, expiry_date, zone_id, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'in_storage')
            RETURNING *
        `;
        const { rows: insertedBatches } = await db.query(insertBatchQuery, [
            batch_id,
            ean13_barcode,
            quantity,
            manufacturing_date,
            expiryDate,
            zone_id
        ]);
        const newBatch = insertedBatches[0];

        // Insert into batch_zone_history
        const insertHistoryQuery = `
            INSERT INTO batch_zone_history (batch_id, zone_id, entry_timestamp)
            VALUES ($1, $2, NOW())
        `;
        await db.query(insertHistoryQuery, [batch_id, zone_id]);

        // Insert initial freshness_scores row
        const insertFreshnessQuery = `
            INSERT INTO freshness_scores (batch_id, frs_score, risk_band, last_updated)
            VALUES ($1, 100, 'low', NOW())
        `;
        await db.query(insertFreshnessQuery, [batch_id]);

        await db.query('COMMIT');

        res.status(201).json(newBatch);

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error registering batch:', error);
        res.status(500).json({ message: 'Server error registering batch' });
    }
};

const getAllBatches = async (req, res) => {
    try {
        const query = `
            SELECT 
                b.batch_id, 
                p.product_name, 
                p.pack_size, 
                b.zone_id, 
                b.status, 
                fs.frs_score, 
                fs.risk_band, 
                b.expiry_date
            FROM batches b
            JOIN products p ON b.ean13_barcode = p.ean13_barcode
            JOIN freshness_scores fs ON b.batch_id = fs.batch_id
        `;
        const { rows } = await db.query(query);

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error getting all batches:', error);
        res.status(500).json({ message: 'Server error retrieving batches' });
    }
};

const updateBatchZone = async (req, res) => {
    const { batch_id } = req.params;
    const { new_zone_id } = req.body;

    try {
        await db.query('BEGIN');

        // Close current batch_zone_history entry
        const closeHistoryQuery = `
            UPDATE batch_zone_history
            SET exit_timestamp = NOW()
            WHERE batch_id = $1 AND exit_timestamp IS NULL
        `;
        await db.query(closeHistoryQuery, [batch_id]);

        // Create new batch_zone_history entry
        const createHistoryQuery = `
            INSERT INTO batch_zone_history (batch_id, zone_id, entry_timestamp)
            VALUES ($1, $2, NOW())
        `;
        await db.query(createHistoryQuery, [batch_id, new_zone_id]);

        // Update batches.zone_id
        const updateBatchQuery = `
            UPDATE batches
            SET zone_id = $1
            WHERE batch_id = $2
            RETURNING *
        `;
        const { rows: updatedBatches } = await db.query(updateBatchQuery, [new_zone_id, batch_id]);

        if (updatedBatches.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Batch not found' });
        }

        await db.query('COMMIT');

        res.status(200).json(updatedBatches[0]);

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error updating batch zone:', error);
        res.status(500).json({ message: 'Server error updating batch zone' });
    }
};

module.exports = {
    registerBatch,
    getAllBatches,
    updateBatchZone
};
