const db = require('../config/db');

exports.getRepIntelligence = async (req, res) => {
    const { region, repWorkId } = req.query;

    if (!region || !repWorkId) {
        return res.status(400).json({ message: 'region and repWorkId are required query parameters.' });
    }

    try {
        // ── QUERY 1: Regional Velocity Trends (Booms & Dips) ───────────
        const velocityRes = await db.query(`
            SELECT
                li.category,
                AVG(li.movement_score_final) as avg_velocity,
                COUNT(*) as report_volume
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            WHERE r.region = $1
              AND r.submitted_at >= NOW() - INTERVAL '30 days'
            GROUP BY li.category
            ORDER BY AVG(li.movement_score_final) DESC
        `, [region]);

        // ── QUERY 2: Warehouse Synergy (High-Risk Stock arriving in region) ─────
        const warehouseRes = await db.query(`
            SELECT 
                p.product_name,
                dr.distributor_name,
                fs.frs_score,
                fs.risk_band,
                d.dispatch_timestamp
            FROM dispatch_records d
            JOIN batches b ON d.batch_id = b.batch_id
            JOIN products p ON b.product_id = p.product_id
            JOIN distributor_records dr ON d.distributor_id = dr.distributor_id
            JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE dr.region = $1
              AND fs.risk_band IN ('high', 'medium')
              AND d.dispatch_timestamp >= NOW() - INTERVAL '3 days'
            ORDER BY d.dispatch_timestamp DESC
            LIMIT 5
        `, [region]);

        // ── QUERY 3: Personalized OOS Flashbacks (Their own history) ───────────
        const oosFlashbacksRes = await db.query(`
            SELECT 
                r.retailer_name,
                li.product_name,
                r.submitted_at
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            WHERE r.rep_work_id = $1
              AND li.is_empty_shelf = true
              AND r.submitted_at >= NOW() - INTERVAL '14 days'
            ORDER BY r.submitted_at DESC
            LIMIT 5
        `, [repWorkId]);

        // ── QUERY 4: Overall Rep Stats for Greeting ───────────
        const repInfoRes = await db.query(`SELECT name FROM sales_reps WHERE work_id = $1`, [repWorkId]);
        const repName = repInfoRes.rows[0]?.name || 'Sales Representative';

        // ── Formatting Logic ──────────────────────────────────────────────
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

        const warehouseAlerts = warehouseRes.rows.map(r => ({
            product: r.product_name,
            distributor: r.distributor_name,
            status: r.risk_band === 'high' ? 'CRITICAL CLEARANCE' : 'STOCK ARRIVING',
            urgency: r.frs_score
        }));

        const oosReminders = oosFlashbacksRes.rows.map(r => ({
            retailer: r.retailer_name,
            product: r.product_name,
            date: r.submitted_at
        }));

        const trends = {
            booming: velocityRes.rows.filter(r => parseFloat(r.avg_velocity) >= 2.5).map(r => r.category),
            dipping: velocityRes.rows.filter(r => parseFloat(r.avg_velocity) < 1.5).map(r => r.category)
        };

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
            submissionStatus = "No reports this month yet.";
            submissionColor = '#ef4444';
        } else if (daysSinceLast <= 2) {
            submissionStatus = `Last submitted ${Math.round(daysSinceLast)} day(s) ago. Great job!`;
            submissionColor = '#22c55e';
        } else {
            submissionStatus = `Last submitted ${Math.round(daysSinceLast)} days ago. Update soon!`;
            submissionColor = '#f59e0b';
        }

        // ── Actionable Today's Focus List ─────────────────────────────────────
        const focusItems = [];
        if (oosReminders.length > 0) focusItems.push(`Verify stock replenishment at ${oosReminders[0].retailer}`);
        if (warehouseAlerts.length > 0) focusItems.push(`Push ${warehouseAlerts[0].product} to local retailers (Warehouse Clearance)`);
        if (trends.booming.length > 0) focusItems.push(`Capitalize on ${trends.booming[0]} demand surge in ${region}`);

        // ── Shape response ────────────────────────────────────────────────
        res.json({
            greeting: `${greeting}, ${repName}!`,
            pulseRegion: region,
            focusItems,
            warehouseSynergy: warehouseAlerts,
            personalReminders: oosReminders,
            regionalTrends: trends,
            submissionHistory: {
                totalThisMonth: parseInt(subRow?.total_this_month) || 0,
                lastSubmittedAt: subRow?.last_submitted_at,
                submissionStatus,
                submissionColor
            },
            repStats: { region, workId: repWorkId }
        });

    } catch (error) {
        console.error('[repIntelligence] ERROR:', error.message);
        res.status(500).json({ message: 'Server error generating Intelligence Pulse.' });
    }
};
