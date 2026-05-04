const db = require('../config/db');

exports.getRepIntelligence = async (req, res) => {
    const { region, repWorkId } = req.query;

    if (!region || !repWorkId) {
        return res.status(400).json({ message: 'region and repWorkId are required query parameters.' });
    }

    try {
        // ── QUERY 1: Slow movers in this region (last 30 days) ───────────
        const slowMoversRes = await db.query(`
            SELECT
                li.sku,
                li.product_name,
                AVG(li.movement_score_final) AS avg_score,
                COUNT(DISTINCT r.report_id) AS times_reported,
                MAX(r.submitted_at) AS last_reported
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            WHERE r.region = $1
              AND r.submitted_at >= NOW() - INTERVAL '30 days'
            GROUP BY li.sku, li.product_name
            HAVING AVG(li.movement_score_final) < 1.5
            ORDER BY AVG(li.movement_score_final) ASC
            LIMIT 5
        `, [region]);

        // ── QUERY 2: This rep's submission history this month ─────────────
        const submissionRes = await db.query(`
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

        // ── QUERY 3: Empty shelf alerts from region (last 7 days) ─────────
        const emptyShelfRes = await db.query(`
            SELECT
                li.sku,
                li.product_name,
                COUNT(*) AS empty_count,
                MAX(r.submitted_at) AS last_reported
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            WHERE r.region = $1
              AND li.is_empty_shelf = true
              AND r.submitted_at >= NOW() - INTERVAL '7 days'
            GROUP BY li.sku, li.product_name
            ORDER BY empty_count DESC
            LIMIT 3
        `, [region]);

        // ── Greeting ──────────────────────────────────────────────────────
        const hour = new Date().getHours();
        const greeting =
            hour < 12 ? 'Good morning' :
            hour < 17 ? 'Good afternoon' :
            'Good evening';

        // ── Submission status message ─────────────────────────────────────
        const subRow = submissionRes.rows[0];
        const totalThisMonth = parseInt(subRow?.total_this_month) || 0;
        const lastSubmittedAt = subRow?.last_submitted_at || null;
        const daysSinceLast = subRow?.days_since_last_submission != null
            ? parseFloat(subRow.days_since_last_submission)
            : null;

        let submissionStatus, submissionColor;
        if (daysSinceLast === null) {
            submissionStatus = "You haven't submitted any reports this month yet.";
            submissionColor = '#ef4444';
        } else if (daysSinceLast <= 2) {
            submissionStatus = `Last submitted ${Math.round(daysSinceLast)} day(s) ago. Good work staying current.`;
            submissionColor = '#22c55e';
        } else if (daysSinceLast <= 5) {
            submissionStatus = `Last submitted ${Math.round(daysSinceLast)} days ago. Consider submitting soon.`;
            submissionColor = '#f59e0b';
        } else {
            submissionStatus = `Last submitted ${Math.round(daysSinceLast)} days ago. Your region data may be outdated.`;
            submissionColor = '#ef4444';
        }

        // ── Shape response ────────────────────────────────────────────────
        const slowMovers = slowMoversRes.rows.map(r => ({
            sku: r.sku,
            productName: r.product_name,
            avgScore: parseFloat(r.avg_score),
            timesReported: parseInt(r.times_reported),
            lastReported: r.last_reported,
            speedLabel: 'Slow'
        }));

        const emptyShelfAlerts = emptyShelfRes.rows.map(r => ({
            sku: r.sku,
            productName: r.product_name,
            emptyCount: parseInt(r.empty_count),
            lastReported: r.last_reported
        }));

        const hasAlerts =
            slowMovers.length > 0 ||
            emptyShelfAlerts.length > 0;

        res.json({
            greeting,
            repRegion: region,

            submissionHistory: {
                totalThisMonth,
                lastSubmittedAt,
                daysSinceLastSubmission: daysSinceLast,
                submissionStatus,
                submissionColor
            },

            slowMovers,
            emptyShelfAlerts,
            hasAlerts
        });

    } catch (error) {
        console.error('[repIntelligence] ERROR:', error.message);
        console.error('[repIntelligence] DETAIL:', error.stack);
        res.status(500).json({ message: 'Server error fetching regional intelligence.' });
    }
};
