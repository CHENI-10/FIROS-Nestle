const db = require('../config/db');

exports.getRepIntelligence = async (req, res) => {
    const { region, repWorkId } = req.query;

    if (!region || !repWorkId || repWorkId === 'undefined') {
        return res.status(400).json({ message: 'Valid region and repWorkId are required query parameters.' });
    }

    console.log(`[repIntelligence] Fetching for Rep: ${repWorkId}, Region: ${region}`);

    try {
        // ── QUERY 1: Personalized Flashbacks (LATEST Status only) ───────────
        // We only care about the MOST RECENT report for each product at each retailer.
        // If the latest report is "Fixed", it won't show up here.
        const flashbacksRes = await db.query(`
            SELECT * FROM (
                SELECT DISTINCT ON (r.retailer_name, li.sku)
                    r.retailer_name,
                    COALESCE(p.product_name || ' - ' || p.pack_size, li.product_name, 'Unknown Product') as display_name,
                    li.sku,
                    li.is_empty_shelf,
                    li.movement_score_final,
                    li.movement_speed_raw,
                    li.shelf_availability,
                    r.submitted_at
                FROM sales_rep_reports r
                JOIN report_line_items li ON r.report_id = li.report_id
                LEFT JOIN products p ON li.sku = p.ean13_barcode
                WHERE r.rep_work_id = $1
                  AND r.submitted_at >= NOW() - INTERVAL '14 days'
                ORDER BY r.retailer_name, li.sku, r.submitted_at DESC
            ) latest_status
            WHERE (is_empty_shelf = true OR movement_score_final <= 1.5)
            ORDER BY submitted_at DESC
        `, [repWorkId]);

        // ── QUERY 4: Overall Rep Stats for Greeting ───────────
        const repInfoRes = await db.query(`SELECT name FROM sales_reps WHERE work_id = $1`, [repWorkId]);
        const repName = repInfoRes.rows[0]?.name || 'Sales Representative';

        // ── Formatting Logic ──────────────────────────────────────────────
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';



        const oosReminders = flashbacksRes.rows.filter(r => r.is_empty_shelf).map(r => ({
            retailer: r.retailer_name,
            product: r.display_name,
            date: r.submitted_at
        }));

        const slowMovers = flashbacksRes.rows.filter(r => !r.is_empty_shelf && r.movement_score_final <= 1.5).map(r => {
            const speedMap = { 1: 'Slow', 2: 'Medium', 3: 'Fast' };
            const stockMap = {
                'low': 'Low stock',
                'in_stock': 'Med stock',
                'high': 'High stock',
                'out_of_stock': 'Out of Stock'
            };
            return {
                retailer: r.retailer_name,
                product: r.display_name,
                date: r.submitted_at,
                speedRating: speedMap[r.movement_speed_raw] || 'Slow',
                stockRating: stockMap[r.shelf_availability] || 'In stock'
            };
        });



        // ── QUERY 5: Submission History ───────────
        const subRes = await db.query(`
            SELECT
                COUNT(*) AS total_this_month,
                MAX(submitted_at) AS last_submitted_at,
                CASE
                    WHEN MAX(submitted_at) IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (NOW() - MAX(submitted_at))) / 86400
                    ELSE NULL
                END AS days_since_last_submission
            FROM sales_rep_reports
            WHERE rep_work_id = $1
              AND submitted_at >= DATE_TRUNC('month', NOW())
        `, [repWorkId]);

        const subRow = subRes.rows[0];
        const daysSinceLast = subRow?.days_since_last_submission != null ? parseFloat(subRow.days_since_last_submission) : null;
        let submissionStatus, submissionColor;
        if (daysSinceLast === null) {
            submissionStatus = "No reports submitted this month.";
            submissionColor = '#ef4444';
        } else {
            submissionStatus = `Last submitted ${Math.round(daysSinceLast)} day(s) ago.`;
            submissionColor = '#22c55e';
        }

        // ── Actionable Today's Focus List ─────────────────────────────────────
        const focusItems = [];

        // 1. Replenishment Follow-ups (Unique retailers)
        const uniqueOosRetailers = [...new Set(oosReminders.map(r => r.retailer))];
        uniqueOosRetailers.forEach(retailer => {
            focusItems.push(`Verify stock replenishment at ${retailer}`);
        });

        // 2. Visibility Checks (Unique products/retailers)
        const slowMoverItems = slowMovers.slice(0, 3); // Limit to top 3 slow movers to avoid clutter
        slowMoverItems.forEach(item => {
            focusItems.push(`Investigate visibility for ${item.product} at ${item.retailer}`);
        });

        // ── Shape response ────────────────────────────────────────────────
        res.json({
            greeting: `${greeting}, ${repName}!`,
            pulseRegion: region,
            focusItems,
            personalReminders: oosReminders,
            slowMovementWatchlist: slowMovers,
            submissionHistory: {
                totalThisMonth: parseInt(subRow?.total_this_month) || 0,
                lastSubmittedAt: subRow?.last_submitted_at,
                submissionStatus,
                submissionColor
            },
            repStats: { region, workId: repWorkId }
        });

    } catch (error) {
        console.error('[repIntelligence] ERROR DETAILS:', error);
        res.status(500).json({ message: 'Server error generating Intelligence Pulse.', error: error.message });
    }
};
