/**
 * myDistributorsController.js
 * 
 * OPTIMIZED: Uses bulk fetching to avoid N+1 query performance issues.
 */

const pool = require('../config/db');
const { calculateLiveMetrics } = require('../utils/scoreCalculator');
const { buildRelationshipProfile } = require('../utils/relationshipEngine');

exports.getMyDistributors = async (req, res) => {
    try {
        const userId = req.user.userId;

        // STEP 1: Fetch all required data in parallel (Bulk queries)
        const results = await Promise.all([
            // [0] System stats
            pool.query(`
                SELECT 
                    AVG(return_rate) as system_avg_return_rate,
                    AVG(avg_delay) as system_avg_delay,
                    AVG(avg_frs) as system_avg_frs
                FROM (
                    SELECT 
                        d.distributor_id,
                        (SELECT COUNT(*) FROM return_records WHERE distributor_id = d.distributor_id)::float / NULLIF((SELECT COUNT(*) FROM dispatch_records WHERE distributor_id = d.distributor_id), 0) * 100 as return_rate,
                        (SELECT AVG(EXTRACT(EPOCH FROM (collected_timestamp - dispatch_timestamp)) / 86400) FROM dispatch_records WHERE distributor_id = d.distributor_id) as avg_delay,
                        (SELECT AVG(frs_at_dispatch) FROM dispatch_records WHERE distributor_id = d.distributor_id) as avg_frs
                    FROM distributor_records d
                ) sub
            `),
            // [1] Manager name
            pool.query('SELECT full_name FROM users WHERE user_id = $1', [userId])
        ]);

        const [systemStatsRes, userRes] = results;

        // STEP 2: Fetch all distributors with their aggregated metrics (Perfect sync with scorecard logic)
        const distributorsDataRes = await pool.query(`
            SELECT 
                d.distributor_id, 
                d.distributor_name, 
                d.region,
                (SELECT COUNT(*) FROM dispatch_records WHERE distributor_id = d.distributor_id) as total_dispatches,
                (SELECT AVG(frs_at_dispatch) FROM dispatch_records WHERE distributor_id = d.distributor_id) as avg_frs,
                (SELECT AVG(CASE WHEN collected_timestamp IS NOT NULL THEN EXTRACT(EPOCH FROM (collected_timestamp - dispatch_timestamp)) / 86400 END) FROM dispatch_records WHERE distributor_id = d.distributor_id) as avg_delay,
                (SELECT COUNT(*) FROM return_records WHERE distributor_id = d.distributor_id) as total_returns,
                (SELECT COUNT(*) FROM return_records WHERE distributor_id = d.distributor_id AND decision = 'rejected') as rejected_returns,
                (SELECT COUNT(*) FROM return_records WHERE distributor_id = d.distributor_id) as returns_count,
                (SELECT SUM(b.quantity) FROM return_records rr JOIN batches b ON rr.batch_id = b.batch_id WHERE rr.distributor_id = d.distributor_id) as returns_units,
                (SELECT COUNT(*) FROM clearance_records WHERE distributor_id = d.distributor_id) as clearances_count,
                (SELECT SUM(b.quantity) FROM clearance_records cr JOIN batches b ON cr.batch_id = b.batch_id WHERE cr.distributor_id = d.distributor_id) as clearances_units,
                (
                    SELECT COUNT(*) 
                    FROM report_line_items li 
                    JOIN sales_rep_reports r ON li.report_id = r.report_id 
                    WHERE r.distributor_id = d.distributor_id AND li.distributor_miss_flagged = true
                ) as miss_count
            FROM distributor_records d
            ORDER BY d.distributor_name
        `);

        // STEP 3: Build Profiles using the Shared Math Engine
        const processedDistributors = [];
        for (const row of distributorsDataRes.rows) {
            const liveMetrics = calculateLiveMetrics({
                totalDispatches: parseInt(row.total_dispatches) || 0,
                avgFrsAtDispatch: parseFloat(row.avg_frs) || 0,
                avgCollectionDelayDays: parseFloat(row.avg_delay) || 0,
                totalReturns: parseInt(row.total_returns) || 0,
                rejectedReturns: parseInt(row.rejected_returns) || 0,
                missCount: parseInt(row.miss_count) || 0
            });

            // Build health profile (simplified version of relationshipEngine logic)
            const overallScore = parseFloat(liveMetrics.overallScore);
            let health = 'Excellent';
            let healthColor = '#22c55e';
            let badge = '⭐ Top Partner';

            if (overallScore >= 80) {
                health = 'Excellent'; healthColor = '#22c55e'; badge = '⭐ Top Partner';
            } else if (overallScore >= 60) {
                health = 'Fair'; healthColor = '#f59e0b'; badge = '📊 Stable Partner';
            } else {
                health = 'Poor'; healthColor = '#ef4444'; badge = '🚨 Requires Review';
            }

            // STEP 3.1: Smart Labels for UI Signals
            const rRate = parseFloat(liveMetrics.returnRate);
            const dDelay = parseFloat(row.avg_delay) || 0;
            
            let rLabel = 'No Returns ✅';
            let rColor = '#22c55e';
            let rSignal = 'good';
            
            if (rRate > 30) { rLabel = 'High Returns 🚨'; rColor = '#ef4444'; rSignal = 'poor'; }
            else if (rRate > 10) { rLabel = 'Moderate Returns'; rColor = '#f59e0b'; rSignal = 'fair'; }
            else if (rRate > 0) { rLabel = 'Low Returns'; rColor = '#22c55e'; rSignal = 'good'; }

            let dLabel = 'Fast Collection';
            let dColor = '#22c55e';
            let dSignal = 'good';

            if (dDelay > 5) { dLabel = 'Slow Pickup ⚠️'; dColor = '#ef4444'; dSignal = 'poor'; }
            else if (dDelay > 2) { dLabel = 'Moderate Delay'; dColor = '#f59e0b'; dSignal = 'fair'; }

            processedDistributors.push({
                distributorId: row.distributor_id,
                distributorName: row.distributor_name,
                distributorRegion: row.region,
                overallScore: 'LIVE-' + overallScore.toFixed(1),
                health,
                healthColor,
                healthBadge: badge,
                performanceTrend: overallScore >= 80 ? 'Improving' : overallScore >= 60 ? 'Stable' : 'Declining',
                totalReturnsCount: parseInt(row.returns_count) || 0,
                totalReturnsUnits: parseInt(row.returns_units) || 0,
                totalClearancesCount: parseInt(row.clearances_count) || 0,
                totalClearancesUnits: parseInt(row.clearances_units) || 0,
                totalUnitsLost: parseInt(row.returns_units) || 0,
                avgCollectionDelay: dDelay.toFixed(1),
                managerReturnRate: rRate,
                totalDispatches: parseInt(row.total_dispatches) || 0,
                avgFrsAtDispatch: parseFloat(row.avg_frs) || 0,
                signals: {
                    returnSignal: { signal: rSignal, color: rColor, label: rLabel, value: rRate + '%' },
                    delaySignal: { signal: dSignal, color: dColor, label: dLabel, value: dDelay.toFixed(1) + 'd' },
                    missSignal: parseInt(row.miss_count) > 0 ? { signal: 'poor', color: '#ef4444', label: 'Deliveries missed', value: row.miss_count } : null
                }
            });
        }

        // STEP 5: Sort results
        const healthMap = { 'Poor': 4, 'Fair': 3, 'Good': 2, 'Excellent': 1 };
        processedDistributors.sort((a, b) => {
            if (healthMap[b.health] !== healthMap[a.health]) return healthMap[b.health] - healthMap[a.health];
            return b.totalDispatches - a.totalDispatches;
        });

        // STEP 4: Calculate Manager Totals & Portfolio Trends
        const stats = systemStatsRes.rows[0] || {};
        const portfolioTrend = {
            improving: processedDistributors.filter(d => d.performanceTrend === 'Improving').length,
            stable: processedDistributors.filter(d => d.performanceTrend === 'Stable').length,
            declining: processedDistributors.filter(d => d.performanceTrend === 'Declining').length
        };

        const systemAvgReturnRate = parseFloat(stats.system_avg_return_rate) || 0;
        const systemAvgCollectionDelay = parseFloat(stats.system_avg_delay) || 0;
        const systemAvgFrsAtDispatch = parseFloat(stats.system_avg_frs) || 0;

        const totalReturnsCount = processedDistributors.reduce((sum, d) => sum + d.totalReturnsCount, 0);
        const totalClearancesCount = processedDistributors.reduce((sum, d) => sum + d.totalClearancesCount, 0);
        const totalReturnsUnits = processedDistributors.reduce((sum, d) => sum + d.totalReturnsUnits, 0);
        const totalClearancesUnits = processedDistributors.reduce((sum, d) => sum + d.totalClearancesUnits, 0);
        const totalUnitsLost = totalReturnsUnits + totalClearancesUnits;
        const totalDispatches = processedDistributors.reduce((sum, d) => sum + d.totalDispatches, 0);
        
        const yourOverallReturnRate = totalDispatches > 0 ? (totalReturnsCount / totalDispatches) * 100 : 0;
        const yourAvgCollectionDelay = processedDistributors.length > 0 
            ? processedDistributors.reduce((sum, d) => sum + parseFloat(d.avgCollectionDelay), 0) / processedDistributors.length 
            : 0;
        const yourAvgFrsAtDispatch = processedDistributors.length > 0 
            ? processedDistributors.reduce((sum, d) => sum + parseFloat(d.avgFrsAtDispatch), 0) / processedDistributors.length 
            : 0;

        const mostReliable = [...processedDistributors]
            .filter(d => d.totalDispatches >= 2)
            .sort((a, b) => healthMap[a.health] - healthMap[b.health] || a.managerReturnRate - b.managerReturnRate)[0];

        const mostProblematic = [...processedDistributors]
            .filter(d => d.totalDispatches >= 2)
            .sort((a, b) => healthMap[b.health] - healthMap[a.health] || b.managerReturnRate - a.managerReturnRate)[0];

        res.json({
            managerName: userRes.rows[0]?.full_name || 'Warehouse Manager',
            portfolioTrend,
            systemAvgReturnRate: parseFloat(systemAvgReturnRate.toFixed(1)),
            systemAvgCollectionDelay: parseFloat(systemAvgCollectionDelay.toFixed(1)),
            systemAvgFrsAtDispatch: parseFloat(systemAvgFrsAtDispatch.toFixed(1)),
            yourOverallReturnRate: parseFloat(yourOverallReturnRate.toFixed(1)),
            yourAvgCollectionDelay: parseFloat(yourAvgCollectionDelay.toFixed(1)),
            yourAvgFrsAtDispatch: parseFloat(yourAvgFrsAtDispatch.toFixed(1)),
            totalReturnsCount,
            totalClearancesCount,
            totalReturnsUnits,
            totalClearancesUnits,
            totalUnitsLost,
            mostReliable: mostReliable ? {
                distributorName: mostReliable.distributorName,
                health: mostReliable.health,
                totalDispatches: mostReliable.totalDispatches
            } : null,
            mostProblematic: mostProblematic ? {
                distributorName: mostProblematic.distributorName,
                health: mostProblematic.health,
                totalDispatches: mostProblematic.totalDispatches
            } : null,
            distributors: processedDistributors
        });

    } catch (err) {
        console.error('Error in getMyDistributors:', err);
        res.status(500).json({ error: 'Failed to fetch distributor intelligence' });
    }
};
