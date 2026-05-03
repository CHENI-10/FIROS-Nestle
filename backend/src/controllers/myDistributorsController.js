/**
 * myDistributorsController.js
 * 
 * OPTIMIZED: Uses bulk fetching to avoid N+1 query performance issues.
 */

const pool = require('../config/db');
const { buildRelationshipProfile } = require('../utils/relationshipEngine');

exports.getMyDistributors = async (req, res) => {
    try {
        const userId = req.user.userId;

        // STEP 1: Fetch all required data in parallel (Bulk queries)
        const [
            systemStatsRes,
            distributorsRes,
            allDispatchesRes,
            allReturnsRes,
            allClearancesRes,
            allScorecardsRes,
            userRes
        ] = await Promise.all([
            // System stats (exclude current manager)
            pool.query(`
                SELECT
                    AVG(return_rate) as system_avg_return_rate,
                    AVG(avg_collection_delay) as system_avg_delay,
                    AVG(avg_frs_at_dispatch) as system_avg_frs
                FROM (
                    SELECT
                        dr.distributor_id,
                        COUNT(rr.return_id)::float / NULLIF(COUNT(dr.dispatch_id), 0) * 100 as return_rate,
                        AVG(EXTRACT(EPOCH FROM (dr.collected_timestamp - dr.dispatch_timestamp)) / 86400) as avg_collection_delay,
                        AVG(dr.frs_at_dispatch) as avg_frs_at_dispatch
                    FROM dispatch_records dr
                    LEFT JOIN return_records rr ON dr.batch_id = rr.batch_id
                    WHERE dr.approved_by != $1
                    GROUP BY dr.distributor_id
                ) sub
            `, [userId]),

            // All distributors
            pool.query(`SELECT distributor_id, distributor_name, region FROM distributor_records ORDER BY distributor_name`),

            // All dispatches for this manager
            pool.query(`
                SELECT
                    dr.distributor_id,
                    dr.dispatch_id,
                    dr.dispatch_timestamp as dispatched_at,
                    dr.collected_timestamp as collected_at,
                    dr.frs_at_dispatch,
                    b.batch_id,
                    p.product_name,
                    b.quantity,
                    b.unit_value,
                    EXTRACT(EPOCH FROM (dr.collected_timestamp - dr.dispatch_timestamp)) / 86400 as collection_delay_days,
                    EXTRACT(MONTH FROM dr.dispatch_timestamp) as month,
                    EXTRACT(YEAR FROM dr.dispatch_timestamp) as year
                FROM dispatch_records dr
                JOIN batches b ON dr.batch_id = b.batch_id
                JOIN products p ON b.product_id = p.product_id
                WHERE dr.dispatch_timestamp IS NOT NULL
                ORDER BY dr.dispatch_timestamp DESC
            `),

            // All returns for this manager
            pool.query(`
                SELECT
                    dr.distributor_id,
                    rr.return_id,
                    rr.decision,
                    rr.created_at,
                    b.quantity,
                    b.unit_value,
                    EXTRACT(MONTH FROM rr.created_at) as month,
                    EXTRACT(YEAR FROM rr.created_at) as year
                FROM return_records rr
                JOIN dispatch_records dr ON rr.batch_id = dr.batch_id
                JOIN batches b ON rr.batch_id = b.batch_id
            `),

            // All clearances for this manager
            pool.query(`
                SELECT
                    cr.distributor_id,
                    cr.clearance_id,
                    cr.cleared_at,
                    b.quantity,
                    b.unit_value,
                    EXTRACT(MONTH FROM cr.cleared_at) as month,
                    EXTRACT(YEAR FROM cr.cleared_at) as year
                FROM clearance_records cr
                JOIN batches b ON cr.batch_id = b.batch_id
            `),

            // All latest scorecards
            pool.query(`
                SELECT DISTINCT ON (distributor_id) distributor_id, performance_score
                FROM distributor_scorecards
                ORDER BY distributor_id, last_updated_at DESC
            `),

            // Manager name
            pool.query('SELECT full_name FROM users WHERE user_id = $1', [userId])
        ]);

        // STEP 2: Process System Stats
        const stats = systemStatsRes.rows[0];
        const systemAvgReturnRate = parseFloat(stats.system_avg_return_rate) || 0;
        const systemAvgCollectionDelay = parseFloat(stats.system_avg_delay) || 0;
        const systemAvgFrsAtDispatch = parseFloat(stats.system_avg_frs) || 0;

        // STEP 3: Map data into lookup dictionaries for O(1) access
        const dispatchesByDist = {};
        allDispatchesRes.rows.forEach(row => {
            if (!dispatchesByDist[row.distributor_id]) dispatchesByDist[row.distributor_id] = [];
            dispatchesByDist[row.distributor_id].push(row);
        });

        const returnsByDist = {};
        allReturnsRes.rows.forEach(row => {
            if (!returnsByDist[row.distributor_id]) returnsByDist[row.distributor_id] = [];
            returnsByDist[row.distributor_id].push(row);
        });

        const clearancesByDist = {};
        allClearancesRes.rows.forEach(row => {
            if (!clearancesByDist[row.distributor_id]) clearancesByDist[row.distributor_id] = [];
            clearancesByDist[row.distributor_id].push(row);
        });

        const scorecardsMap = {};
        allScorecardsRes.rows.forEach(row => {
            scorecardsMap[row.distributor_id] = parseFloat(row.performance_score);
        });

        // STEP 4: Build Profiles
        const processedDistributors = [];
        for (const dist of distributorsRes.rows) {
            const managerDispatches = dispatchesByDist[dist.distributor_id] || [];
            const managerReturns = returnsByDist[dist.distributor_id] || [];
            const managerClearances = clearancesByDist[dist.distributor_id] || [];
            const overallScore = scorecardsMap[dist.distributor_id] || 0;

            if (managerDispatches.length === 0) continue;

            const profile = buildRelationshipProfile({
                distributorId: dist.distributor_id,
                distributorName: dist.distributor_name,
                distributorRegion: dist.region,
                managerDispatches,
                managerReturns,
                managerClearances,
                systemAvgReturnRate,
                systemAvgCollectionDelay,
                systemAvgFrsAtDispatch,
                overallScore
            });

            if (profile) processedDistributors.push(profile);
        }

        // STEP 5: Sort results
        const healthMap = { 'Poor': 4, 'Fair': 3, 'Good': 2, 'Excellent': 1 };
        processedDistributors.sort((a, b) => {
            if (healthMap[b.health] !== healthMap[a.health]) return healthMap[b.health] - healthMap[a.health];
            return b.totalDispatches - a.totalDispatches;
        });

        // STEP 6: Summary Metrics
        const totalManagerDispatches = processedDistributors.reduce((sum, d) => sum + d.totalDispatches, 0);
        const totalManagerReturns = processedDistributors.reduce((sum, d) => sum + d.totalReturns, 0);
        const yourOverallReturnRate = totalManagerDispatches > 0 ? (totalManagerReturns / totalManagerDispatches) * 100 : 0;

        const totalReturnsCount = processedDistributors.reduce((sum, d) => sum + d.totalReturnsCount, 0);
        const totalClearancesCount = processedDistributors.reduce((sum, d) => sum + d.totalClearancesCount, 0);
        const totalReturnsUnits = processedDistributors.reduce((sum, d) => sum + d.totalReturnsUnits, 0);
        const totalClearancesUnits = processedDistributors.reduce((sum, d) => sum + d.totalClearancesUnits, 0);
        const totalUnitsLost = totalReturnsUnits + totalClearancesUnits;

        const collectedDelays = processedDistributors.filter(d => d.avgCollectionDelay !== null).map(d => d.avgCollectionDelay);
        const yourAvgCollectionDelay = collectedDelays.length > 0 ? (collectedDelays.reduce((a, b) => a + b, 0) / collectedDelays.length) : 0;
        
        const yourAvgFrsAtDispatch = processedDistributors.length > 0 ? (processedDistributors.reduce((sum, d) => sum + d.avgFrsAtDispatch, 0) / processedDistributors.length) : 0;

        const mostReliable = [...processedDistributors]
            .filter(d => d.totalDispatches >= 3)
            .sort((a, b) => healthMap[a.health] - healthMap[b.health] || a.managerReturnRate - b.managerReturnRate)[0];

        const mostProblematic = [...processedDistributors]
            .filter(d => d.totalDispatches >= 2)
            .sort((a, b) => healthMap[b.health] - healthMap[a.health] || b.managerReturnRate - a.managerReturnRate)[0];

        res.json({
            managerName: userRes.rows[0]?.full_name || 'Warehouse Manager',
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
