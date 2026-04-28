const db = require('../config/db');

// GET /api/manager/reports
const getReports = async (req, res) => {
    try {
        const { region, from, to, search } = req.query;
        let query = `
            SELECT 
                r.report_id as "reportId",
                r.region,
                r.retailer_name as "retailerName",
                r.distributor_name as "distributorName",
                r.audit_date as "auditDate",
                r.submitted_at as "submittedAt",
                r.status,
                u.full_name as "repName",
                u.user_id as "repId",
                COUNT(l.sku) as "totalProducts",
                COUNT(CASE WHEN l.is_empty_shelf = true THEN 1 END) as "emptyShelvesCount"
            FROM sales_rep_reports r
            LEFT JOIN users u ON r.sales_rep_id = u.user_id
            LEFT JOIN report_line_items l ON r.report_id = l.report_id
            WHERE 1=1
        `;
        const params = [];

        if (region && region !== 'All') {
            params.push(region);
            query += ` AND r.region = $${params.length}`;
        }
        if (from) {
            params.push(from);
            query += ` AND r.audit_date >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            query += ` AND r.audit_date <= $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (u.full_name ILIKE $${params.length} OR r.retailer_name ILIKE $${params.length})`;
        }

        query += ` GROUP BY r.report_id, u.full_name, u.user_id ORDER BY r.submitted_at DESC`;

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching manager reports:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/manager/reports/:reportId
const getReportById = async (req, res) => {
    try {
        const { reportId } = req.params;
        
        const reportQuery = `
            SELECT 
                r.report_id as "reportId",
                u.full_name as "repName",
                r.region,
                r.retailer_name as "retailerName",
                r.distributor_name as "distributorName",
                r.audit_date as "auditDate",
                r.submitted_at as "submittedAt",
                r.notes,
                r.status,
                r.reviewed_at as "reviewedAt"
            FROM sales_rep_reports r
            LEFT JOIN users u ON r.sales_rep_id = u.user_id
            WHERE r.report_id = $1
        `;
        const reportResult = await db.query(reportQuery, [reportId]);
        
        if (reportResult.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }

        const itemsQuery = `
            SELECT 
                sku,
                product_name as "productName",
                category,
                movement_speed_raw as "movementSpeedRaw",
                movement_score_final as "movementScoreFinal",
                shelf_availability as "shelfAvailability",
                is_empty_shelf as "isEmptyShelf",
                urgency_bonus_applied as "urgencyBonusApplied"
            FROM report_line_items
            WHERE report_id = $1
        `;
        const itemsResult = await db.query(itemsQuery, [reportId]);

        const reportData = {
            ...reportResult.rows[0],
            lineItems: itemsResult.rows
        };

        res.json(reportData);
    } catch (error) {
        console.error('Error fetching report details:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PATCH /api/manager/reports/:reportId/review
const reviewReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const managerId = req.user.user_id;

        const updateQuery = `
            UPDATE sales_rep_reports
            SET status = 'reviewed', reviewed_at = NOW(), reviewed_by = $1
            WHERE report_id = $2
            RETURNING status, reviewed_at
        `;
        const result = await db.query(updateQuery, [managerId, reportId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }

        res.json({ success: true, message: "Report marked as reviewed", data: result.rows[0] });
    } catch (error) {
        console.error('Error reviewing report:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getReports,
    getReportById,
    reviewReport
};
