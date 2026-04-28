const db = require('../config/db');

const calcMetrics = (row) => {
    const td = parseInt(row.total_dispatches) || 0;
    const tr = parseInt(row.total_returns) || 0;
    const rejectedReturns = parseInt(row.rejected_returns) || 0;
    const avgFrs = parseFloat(row.avg_frs_at_dispatch) || 0;
    const avgDelay = parseFloat(row.avg_collection_delay_days) || 0;

    const returnRate = td > 0 ? (tr / td) * 100 : 0;
    const returnRejectionRate = tr > 0 ? (rejectedReturns / tr) * 100 : 0;

    // New weighted formula (100 pts total)
    const frs_score = (avgFrs / 100) * 40;
    const return_penalty = Math.min(returnRate, 100) / 100 * 25;
    const rejection_penalty = Math.min(returnRejectionRate, 100) / 100 * 15;
    const delay_penalty = Math.min(avgDelay / 14, 1) * 20;

    let overallScore = frs_score + (25 - return_penalty) + (15 - rejection_penalty) + (20 - delay_penalty);
    overallScore = Math.max(0, Math.min(100, overallScore));

    return {
        totalDispatches: td,
        totalReturns: tr,
        avgFrsAtDispatch: avgFrs.toFixed(1),
        returnRate: returnRate.toFixed(1),
        returnRejectionRate: returnRejectionRate.toFixed(1),
        avgCollectionDelayDays: avgDelay.toFixed(1),
        overallScore: overallScore.toFixed(1)
    };
};

exports.getAllScorecards = async (req, res) => {
    try {
        const distributorRes = await db.query(`SELECT * FROM distributor_records ORDER BY distributor_name`);
        const distributors = distributorRes.rows;

        const regionQuery = `
            SELECT 
                r.region,
                AVG(li.movement_score_final)::numeric as "avgMovementScore",
                MAX(r.submitted_at) as "latestReportDate"
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            GROUP BY r.region
            ORDER BY r.region
        `;
        const { rows: regionRows } = await db.query(regionQuery);

        const scorecards = await Promise.all(distributors.map(async (dist) => {
            const dispRes = await db.query(`
                SELECT 
                    COUNT(*) as total_dispatches,
                    AVG(frs_at_dispatch)::numeric as avg_frs_at_dispatch,
                    AVG(
                        CASE WHEN collected_timestamp IS NOT NULL 
                        THEN EXTRACT(EPOCH FROM (collected_timestamp - dispatch_timestamp)) / 86400 
                        END
                    )::numeric as avg_collection_delay_days
                FROM dispatch_records
                WHERE distributor_id = $1
            `, [dist.distributor_id]);

            const retRes = await db.query(`
                SELECT
                    COUNT(*) as total_returns,
                    COUNT(*) FILTER (WHERE r.decision = 'rejected') as rejected_returns
                FROM return_records r
                WHERE r.distributor_id = $1
            `, [dist.distributor_id]);

            const histRes = await db.query(`
                SELECT performance_score as historical_score
                FROM distributor_scorecards
                WHERE distributor_id = $1
                ORDER BY last_updated_at DESC
                LIMIT 1
            `, [dist.distributor_id]);

            const dispRow = { ...dispRes.rows[0], ...retRes.rows[0] };
            const metrics = calcMetrics(dispRow);

            const hist = histRes.rows.length > 0 ? parseFloat(histRes.rows[0].historical_score) : null;
            let scoreTrend = 'stable';
            if (hist !== null) {
                if (parseFloat(metrics.overallScore) - hist > 2) scoreTrend = 'up';
                else if (hist - parseFloat(metrics.overallScore) > 2) scoreTrend = 'down';
            }

            return {
                distributorId: dist.distributor_id,
                distributorName: dist.distributor_name,
                region: dist.region,
                ...metrics,
                historicalScore: hist !== null ? hist.toFixed(1) : 'N/A',
                scoreTrend,
                regionMovementSpeeds: regionRows
            };
        }));

        res.json(scorecards);
    } catch (error) {
        console.error("Error in getAllScorecards:", error);
        res.status(500).json({ message: 'Server error fetching scorecards' });
    }
};

exports.getScorecardDetail = async (req, res) => {
    try {
        const distId = req.params.distributorId;

        const distRes = await db.query(`SELECT * FROM distributor_records WHERE distributor_id = $1`, [distId]);
        if (distRes.rows.length === 0) return res.status(404).json({ message: 'Distributor not found' });
        const dist = distRes.rows[0];

        const dispRes = await db.query(`
            SELECT 
                COUNT(*) as total_dispatches,
                AVG(frs_at_dispatch)::numeric as avg_frs_at_dispatch,
                AVG(
                    CASE WHEN collected_timestamp IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (collected_timestamp - dispatch_timestamp)) / 86400 
                    END
                )::numeric as avg_collection_delay_days
            FROM dispatch_records
            WHERE distributor_id = $1
        `, [distId]);

        const retRes = await db.query(`
            SELECT
                COUNT(*) as total_returns,
                COUNT(*) FILTER (WHERE r.decision = 'rejected') as rejected_returns
            FROM return_records r
            WHERE r.distributor_id = $1
        `, [distId]);

        const histRes = await db.query(`
            SELECT performance_score as historical_score
            FROM distributor_scorecards
            WHERE distributor_id = $1
            ORDER BY last_updated_at DESC
            LIMIT 1
        `, [distId]);

        const dispRow = { ...dispRes.rows[0], ...retRes.rows[0] };
        const metrics = calcMetrics(dispRow);

        const hist = histRes.rows.length > 0 ? parseFloat(histRes.rows[0].historical_score) : null;
        let scoreTrend = 'stable';
        if (hist !== null) {
            if (parseFloat(metrics.overallScore) - hist > 2) scoreTrend = 'up';
            else if (hist - parseFloat(metrics.overallScore) > 2) scoreTrend = 'down';
        }

        const histTrendRes = await db.query(`
            SELECT 
                performance_score as overall_score,
                TO_CHAR(last_updated_at, 'Mon YYYY') as period_label
            FROM distributor_scorecards
            WHERE distributor_id = $1
            ORDER BY last_updated_at DESC
            LIMIT 5
        `, [distId]);
        const historicalTrend = histTrendRes.rows.reverse();

        const recentDispRes = await db.query(`
            SELECT 
                dispatch_id as "dispatchId",
                dispatch_timestamp as date,
                batch_id as "batchId",
                frs_at_dispatch as frs,
                CASE WHEN collected_timestamp IS NOT NULL THEN 'collected' ELSE 'dispatched' END as status
            FROM dispatch_records
            WHERE distributor_id = $1
            ORDER BY dispatch_timestamp DESC
            LIMIT 10
        `, [distId]);

        const recentRetRes = await db.query(`
            SELECT 
                r.return_id as "returnId",
                r.created_at as date,
                r.return_reason as reason,
                r.decision
            FROM return_records r
            WHERE r.distributor_id = $1
            ORDER BY r.created_at DESC
            LIMIT 5
        `, [distId]);

        const regionRes = await db.query(`
            SELECT 
                r.region,
                AVG(li.movement_score_final)::numeric as "avgMovementScore",
                MAX(r.submitted_at) as "latestReportDate"
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            GROUP BY r.region
            ORDER BY r.region
        `);

        res.json({
            distributorId: dist.distributor_id,
            distributorName: dist.distributor_name,
            region: dist.region,
            metrics: {
                ...metrics,
                historicalScore: hist !== null ? hist.toFixed(1) : 'N/A',
                scoreTrend
            },
            historicalTrend,
            recentDispatches: recentDispRes.rows,
            recentReturns: recentRetRes.rows,
            regionMovementSpeeds: regionRes.rows
        });

    } catch (error) {
        console.error("Error in getScorecardDetail:", error);
        res.status(500).json({ message: 'Server error fetching scorecard detail' });
    }
};
