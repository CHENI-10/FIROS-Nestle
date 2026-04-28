const db = require('../config/db');

const submitReport = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const { region, retailerName, distributorName, auditDate, notes, lineItems } = req.body;
        const userId = req.user.userId || req.user.user_id;

        // Note: providing dummy values for legacy columns that might still have NOT NULL/CHECK constraints
        const parentQuery = `
            INSERT INTO sales_rep_reports 
            (sales_rep_id, region, retailer_name, distributor_name, audit_date, notes, product_id, movement_speed, movement_score, shelf_availability, urgency_bonus) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING report_id
        `;
        const parentValues = [
            userId, region, retailerName, distributorName, auditDate, notes,
            1, 'fast', 1, 'in_stock', 0 // dummy legacy values
        ];
        
        let reportId;
        try {
            const { rows } = await client.query(parentQuery, parentValues);
            reportId = rows[0].report_id;
        } catch (e) {
            // If it fails because columns don't exist (clean updated schema), we retry without dummy values
            if (e.code === '42703') { // undefined_column
                const cleanParentQuery = `
                    INSERT INTO sales_rep_reports 
                    (sales_rep_id, region, retailer_name, distributor_name, audit_date, notes) 
                    VALUES ($1, $2, $3, $4, $5, $6) 
                    RETURNING report_id
                `;
                const cleanParentValues = [userId, region, retailerName, distributorName, auditDate, notes];
                const cleanRes = await client.query(cleanParentQuery, cleanParentValues);
                reportId = cleanRes.rows[0].report_id;
            } else {
                throw e;
            }
        }

        const childQuery = `
            INSERT INTO report_line_items 
            (report_id, sku, product_name, category, movement_speed_raw, movement_score_final, shelf_availability, is_empty_shelf, urgency_bonus_applied)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        for (const item of lineItems) {
            let movementScoreFinal = item.movementSpeedRaw;
            let urgencyBonusApplied = false;

            if (item.isEmptyShelf || item.shelfAvailability === 'out_of_stock') {
                movementScoreFinal = item.movementSpeedRaw + 1;
                urgencyBonusApplied = true;
            }

            const childValues = [
                reportId,
                item.sku,
                item.productName,
                item.category,
                item.movementSpeedRaw,
                movementScoreFinal,
                item.shelfAvailability,
                item.isEmptyShelf,
                urgencyBonusApplied
            ];

            await client.query(childQuery, childValues);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            reportId,
            message: "Audit submitted successfully"
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting report:', error);
        res.status(500).json({ message: 'Server error while submitting report' });
    } finally {
        client.release();
    }
};

const getReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const userId = req.user.userId || req.user.user_id;

        const parentQuery = 'SELECT * FROM sales_rep_reports WHERE report_id = $1 AND sales_rep_id = $2';
        const parentRes = await db.query(parentQuery, [reportId, userId]);

        if (parentRes.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }

        const report = parentRes.rows[0];

        const childQuery = 'SELECT * FROM report_line_items WHERE report_id = $1';
        const childRes = await db.query(childQuery, [reportId]);

        report.lineItems = childRes.rows;

        res.json(report);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ message: 'Server error while fetching report' });
    }
};

module.exports = {
    submitReport,
    getReport
};
