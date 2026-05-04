const db = require('../config/db');

const submitReport = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const { repWorkId, repName, region, retailerName, distributorName, auditDate, notes, lineItems } = req.body;
        const userId = req.user.userId || req.user.user_id;

        // Resolve distributor_id from name
        const distRes = await client.query('SELECT distributor_id FROM distributor_records WHERE distributor_name = $1', [distributorName]);
        const distributorId = distRes.rows.length > 0 ? distRes.rows[0].distributor_id : null;

        const parentQuery = `
            INSERT INTO sales_rep_reports 
            (sales_rep_id, rep_work_id, rep_name, region, retailer_name, distributor_name, distributor_id, audit_date, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING report_id
        `;
        const parentValues = [
            userId, repWorkId, repName, region, retailerName, distributorName, distributorId, auditDate, notes
        ];
        
        const { rows } = await client.query(parentQuery, parentValues);
        const reportId = rows[0].report_id;

        const childQuery = `
            INSERT INTO report_line_items 
            (report_id, sku, product_name, category, movement_speed_raw, movement_score_final, shelf_availability, is_empty_shelf, urgency_bonus_applied, empty_shelf_reason, distributor_miss_flagged)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        for (const item of lineItems) {
            let movementScoreFinal = item.movementSpeedRaw;
            let urgencyBonusApplied = false;
            let distributorMissFlagged = false;

            if (item.isEmptyShelf) {
                if (item.empty_shelf_reason === 'sold_out') {
                    movementScoreFinal = item.movementSpeedRaw + 1;
                    urgencyBonusApplied = true;
                } else if (item.empty_shelf_reason === 'not_delivered') {
                    movementScoreFinal = item.movementSpeedRaw;
                    urgencyBonusApplied = false;
                    distributorMissFlagged = true;
                }
            } else if (item.shelfAvailability === 'out_of_stock') {
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
                urgencyBonusApplied,
                item.empty_shelf_reason || null,
                distributorMissFlagged
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
