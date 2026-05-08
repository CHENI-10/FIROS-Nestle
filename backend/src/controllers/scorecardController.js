const db = require('../config/db');
const { calculateLiveMetrics } = require('../utils/scoreCalculator');

const calcMetrics = (row) => {
    return calculateLiveMetrics({
        totalDispatches: parseInt(row.total_dispatches) || 0,
        avgFrsAtDispatch: parseFloat(row.avg_frs_at_dispatch) || 0,
        avgCollectionDelayDays: parseFloat(row.avg_collection_delay_days) || 0,
        totalReturns: parseInt(row.total_returns) || 0,
        rejectedReturns: parseInt(row.rejected_returns) || 0,
        missCount: parseInt(row.miss_count) || 0
    });
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

            const missRes = await db.query(`
                SELECT COUNT(*) as miss_count
                FROM report_line_items li
                JOIN sales_rep_reports r ON li.report_id = r.report_id
                WHERE r.distributor_id = $1 AND li.distributor_miss_flagged = true
            `, [dist.distributor_id]);

            const dispRow = { ...dispRes.rows[0], ...retRes.rows[0], ...missRes.rows[0] };
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

        const missRes = await db.query(`
            SELECT COUNT(*) as miss_count
            FROM report_line_items li
            JOIN sales_rep_reports r ON li.report_id = r.report_id
            WHERE r.distributor_id = $1 AND li.distributor_miss_flagged = true
        `, [distId]);

        const dispRow = { ...dispRes.rows[0], ...retRes.rows[0], ...missRes.rows[0] };
        const metrics = calcMetrics(dispRow);

        const hist = histRes.rows.length > 0 ? parseFloat(histRes.rows[0].historical_score) : null;
        let scoreTrend = 'stable';
        if (hist !== null) {
            if (parseFloat(metrics.overallScore) - hist > 2) scoreTrend = 'up';
            else if (hist - parseFloat(metrics.overallScore) > 2) scoreTrend = 'down';
        }

        // DYNAMIC HISTORY: Automatically calculate the last 2 months relative to NOW()
        const histTrendRes = await db.query(`
            SELECT 
                TO_CHAR(months.m, 'TMMon') as period_label,
                COALESCE(d.disp_count, 0) as dispatched_count,
                COALESCE(r.ret_count, 0) as returned_count,
                80 as overall_score 
            FROM (
                SELECT generate_series(
                    date_trunc('month', NOW()) - INTERVAL '1 month', 
                    date_trunc('month', NOW()), 
                    INTERVAL '1 month'
                )::date as m
            ) months
            LEFT JOIN (
                SELECT date_trunc('month', dispatch_timestamp)::date as m, COUNT(*) as disp_count
                FROM dispatch_records
                WHERE distributor_id = $1
                GROUP BY 1
            ) d ON months.m = d.m
            LEFT JOIN (
                SELECT date_trunc('month', created_at)::date as m, COUNT(*) as ret_count
                FROM return_records
                WHERE distributor_id = $1
                GROUP BY 1
            ) r ON months.m = r.m
            ORDER BY months.m ASC
        `, [distId]);
        const historicalTrend = histTrendRes.rows;

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

        const lossRes = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE b.status IN ('cleared', 'returned')) as loss_count,
                COUNT(*) as total_count
            FROM dispatch_records dr
            JOIN batches b ON dr.batch_id = b.batch_id
            WHERE dr.distributor_id = $1
        `, [distId]);
        
        const lossData = lossRes.rows[0];
        const lossContributionPercent = lossData.total_count > 0 
            ? ((parseInt(lossData.loss_count) / parseInt(lossData.total_count)) * 100).toFixed(1)
            : 0;

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

        // AC7: Specific Movement Score for this distributor's region
        const localMovement = regionRes.rows.find(r => r.region === dist.region);

        res.json({
            distributorId: dist.distributor_id,
            distributorName: dist.distributor_name,
            region: dist.region,
            metrics: {
                ...metrics,
                historicalScore: hist !== null ? hist.toFixed(1) : 'N/A',
                scoreTrend,
                lossContributionCount: parseInt(lossData.loss_count) || 0,
                lossContributionPercent: parseFloat(lossContributionPercent)
            },
            historicalTrend,
            recentDispatches: recentDispRes.rows,
            recentReturns: recentRetRes.rows,
            regionMovementSpeeds: regionRes.rows,
            localMovementScore: localMovement ? parseFloat(localMovement.avgMovementScore).toFixed(1) : 'N/A'
        });

    } catch (error) {
        console.error("Error in getScorecardDetail:", error);
        res.status(500).json({ message: 'Server error fetching scorecard detail' });
    }
};
