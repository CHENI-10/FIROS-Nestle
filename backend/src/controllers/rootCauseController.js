const pool = require('../config/db');
const { categoriseBatch, detectPatterns } = require('../utils/rootCauseEngine');

const getRootCauseAnalytics = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        // Time period support
        const monthParam = req.query.month;
        const yearParam = req.query.year;
        const periodDays = req.query.period ? parseInt(req.query.period) : null;
        
        let startDate, endDate;
        let prevStartDate, prevEndDate;
        let periodLabel = '';

        if (periodDays && [30, 60, 90].includes(periodDays)) {
            // Last N days
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(endDate.getDate() - periodDays);
            
            prevEndDate = new Date(startDate);
            prevStartDate = new Date(startDate);
            prevStartDate.setDate(prevEndDate.getDate() - periodDays);
            
            periodLabel = `Last ${periodDays} Days`;
        } else {
            // Month navigation (default)
            let targetDate;
            if (monthParam && yearParam) {
                targetDate = new Date(yearParam, monthParam - 1, 1);
            } else {
                const now = new Date();
                targetDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
            
            startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
            endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
            
            prevStartDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
            prevEndDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0, 23, 59, 59);
            
            const monthNames = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            periodLabel = `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
        }
        
        // Format for DB queries
        const startStr = startDate.toISOString();
        const endStr = endDate.toISOString();
        const prevStartStr = prevStartDate.toISOString();
        const prevEndStr = prevEndDate.toISOString();

        // Get manager full name for header
        const userResult = await pool.query('SELECT full_name FROM users WHERE user_id = $1', [userId]);
        const managerName = userResult.rows[0]?.full_name || 'Manager';

        // Helper function to fetch stats for a range
        const fetchStats = async (start, end, managerId) => {
            const batchesQuery = `
                SELECT
                    b.batch_id as "batchId",
                    p.product_name || ' ' || p.pack_size as sku,
                    p.product_name as "productName",
                    b.zone_id as zone,
                    fs.days_in_warehouse as "daysInWarehouse",
                    fs.total_temp_breach_windows as "tempBreachWindows",
                    dr.dispatch_timestamp as dispatched_at,
                    dr.collected_timestamp as collected_at,
                    dr.distributor_id,
                    d.distributor_name as "distributorName",
                    b.status,
                    EXTRACT(DOW FROM dr.dispatch_timestamp) as dispatch_day_of_week
                FROM dispatch_records dr
                JOIN batches b ON dr.batch_id = b.batch_id
                JOIN products p ON b.product_id = p.product_id
                JOIN freshness_scores fs ON b.batch_id = fs.batch_id
                JOIN distributor_records d ON dr.distributor_id = d.distributor_id
                WHERE dr.approved_by = $1
                AND b.status IN ('cleared', 'returned')
                AND dr.dispatch_timestamp >= $2 AND dr.dispatch_timestamp <= $3
            `;
            const batchesRes = await pool.query(batchesQuery, [managerId, start, end]);
            
            const totalDispatchesQuery = `
                SELECT COUNT(*) 
                FROM dispatch_records 
                WHERE approved_by = $1
                AND dispatch_timestamp >= $2 AND dispatch_timestamp <= $3
            `;
            const totalDispatchesRes = await pool.query(totalDispatchesQuery, [managerId, start, end]);
            
            const totalDispatched = parseInt(totalDispatchesRes.rows[0].count) || 0;
            const failedBatches = batchesRes.rows.map(b => ({
                ...b,
                total_temp_breach_windows: parseInt(b.tempBreachWindows) || 0,
                days_in_warehouse: parseInt(b.daysInWarehouse) || 0,
                ...categoriseBatch({
                    ...b,
                    total_temp_breach_windows: parseInt(b.tempBreachWindows) || 0,
                    days_in_warehouse: parseInt(b.daysInWarehouse) || 0
                })
            }));

            return { totalDispatched, failedBatches };
        };

        // Fetch CURRENT period stats
        const currentStats = await fetchStats(startStr, endStr, userId);
        const { totalDispatched, failedBatches } = currentStats;

        // Fetch PREVIOUS period stats for comparison
        const prevStats = await fetchStats(prevStartStr, prevEndStr, userId);
        const { totalDispatched: prevTotalDispatched, failedBatches: prevFailedBatches } = prevStats;

        const totalCleared = failedBatches.filter(b => b.status === 'cleared').length;
        const totalReturned = failedBatches.filter(b => b.status === 'returned').length;
        const totalFailed = failedBatches.length;
        const failureRate = totalDispatched > 0 ? (totalFailed / totalDispatched) * 100 : 0;

        const prevTotalFailed = prevFailedBatches.length;
        const prevFailureRate = prevTotalDispatched > 0 ? (prevTotalFailed / prevTotalDispatched) * 100 : 0;

        // Categorize results for current
        const rootCauses = detectPatterns(failedBatches);
        rootCauses.forEach(rc => {
            rc.percentage = totalFailed > 0 ? Math.round((rc.count / totalFailed) * 100) : 0;
        });

        // STEP 3: System-wide averages (Current Period)
        const sysBatchesQuery = `
            SELECT 
                b.batch_id, 
                fs.days_in_warehouse, 
                fs.total_temp_breach_windows, 
                dr.dispatch_timestamp as dispatched_at, 
                dr.collected_timestamp as collected_at
            FROM dispatch_records dr
            JOIN batches b ON dr.batch_id = b.batch_id
            JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE dr.approved_by != $1
            AND b.status IN ('cleared', 'returned')
            AND dr.dispatch_timestamp >= $2 AND dr.dispatch_timestamp <= $3
        `;
        const sysBatchesResult = await pool.query(sysBatchesQuery, [userId, startStr, endStr]);
        const sysFailedBatches = sysBatchesResult.rows;

        const sysDispatchesQuery = `
            SELECT COUNT(*), COUNT(DISTINCT approved_by) as distinct_managers
            FROM dispatch_records 
            WHERE approved_by != $1
            AND dispatch_timestamp >= $2 AND dispatch_timestamp <= $3
        `;
        const sysDispatchesResult = await pool.query(sysDispatchesQuery, [userId, startStr, endStr]);
        const sysTotalDispatched = parseInt(sysDispatchesResult.rows[0].count) || 0;
        const distinctManagers = parseInt(sysDispatchesResult.rows[0].distinct_managers) || 1;

        const systemAvgFailureRate = sysTotalDispatched > 0 ? (sysFailedBatches.length / sysTotalDispatched) * 100 : 0;

        // Calculate failureStatus
        let failureStatus = 'on_par';
        if (failureRate > systemAvgFailureRate + 5) {
            failureStatus = 'above_average';
        } else if (failureRate < systemAvgFailureRate - 5) {
            failureStatus = 'below_average';
        }

        // STEP 5: Category breakdown for system
        let sysTempFailures = 0, sysLongStorage = 0, sysDistDelay = 0;
        sysFailedBatches.forEach(b => {
            const formatted = {
                ...b,
                total_temp_breach_windows: parseInt(b.total_temp_breach_windows) || 0,
                days_in_warehouse: parseInt(b.days_in_warehouse) || 0
            };
            const cat = categoriseBatch(formatted).category;
            if (cat === 'Temperature-Driven') sysTempFailures++;
            if (cat === 'Long Storage') sysLongStorage++;
            if (cat === 'Distributor Delay') sysDistDelay++;
        });

        // STEP 6: Recurring Problem Products
        const skuCounts = {};
        failedBatches.forEach(b => {
            skuCounts[b.sku] = (skuCounts[b.sku] || 0) + 1;
        });
        const recurringProblemProducts = Object.keys(skuCounts)
            .filter(sku => skuCounts[sku] >= 3)
            .map(sku => ({
                sku,
                productName: failedBatches.find(b => b.sku === sku).productName,
                failureCount: skuCounts[sku],
                severity: skuCounts[sku] >= 5 ? 'high' : 'medium'
            }))
            .sort((a, b) => b.failureCount - a.failureCount);

        // STEP 7: Problem Zones
        const zoneTempCounts = {};
        failedBatches.filter(b => b.category === 'Temperature-Driven').forEach(b => {
            zoneTempCounts[b.zone] = (zoneTempCounts[b.zone] || 0) + 1;
        });
        const problemZones = Object.keys(zoneTempCounts)
            .filter(zone => zoneTempCounts[zone] >= 3)
            .map(zone => ({
                zone,
                tempFailureCount: zoneTempCounts[zone],
                severity: zoneTempCounts[zone] >= 5 ? 'high' : 'medium'
            }))
            .sort((a, b) => b.tempFailureCount - a.tempFailureCount);

        // Navigation (only if month navigation is used)
        let availableMonths = [];
        if (!periodDays) {
            const monthsQuery = `
                SELECT DISTINCT DATE_TRUNC('month', dispatch_timestamp AT TIME ZONE 'Asia/Kolkata') as month_date
                FROM dispatch_records
                WHERE approved_by = $1
                ORDER BY month_date ASC
            `;
            const monthsResult = await pool.query(monthsQuery, [userId]);
            const monthNames = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            availableMonths = monthsResult.rows.map(r => {
                const d = new Date(r.month_date);
                return {
                    month: d.getMonth() + 1,
                    year: d.getFullYear(),
                    label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`
                };
            });
        }

        // Comparison Deltas
        const failuresDelta = totalFailed - prevTotalFailed;
        const tempFailuresDelta = failedBatches.filter(b => b.category === 'Temperature-Driven').length - 
                                 prevFailedBatches.filter(b => b.category === 'Temperature-Driven').length;
        const longStorageDelta = failedBatches.filter(b => b.category === 'Long Storage').length - 
                                 prevFailedBatches.filter(b => b.category === 'Long Storage').length;

        // Compile final response
        return res.json({
            managerName,
            periodLabel,
            month: startDate.getMonth() + 1,
            year: startDate.getFullYear(),
            periodDays,
            
            summary: {
                totalDispatched,
                totalFailed,
                totalCleared,
                totalReturned,
                failureRate: parseFloat(failureRate.toFixed(1)),
                systemAvgFailureRate: parseFloat(systemAvgFailureRate.toFixed(1)),
                failureStatus,
                
                // New comparison fields
                comparison: {
                    prevTotalFailed,
                    failuresDelta,
                    failureRateDelta: parseFloat((failureRate - prevFailureRate).toFixed(1)),
                    tempFailuresDelta,
                    longStorageDelta,
                    comparisonLabel: periodDays ? `vs Previous ${periodDays} Days` : "vs Last Month"
                }
            },

            rootCauses,
            recurringProblemProducts,
            problemZones,

            comparison: {
                yourFailureRate: parseFloat(failureRate.toFixed(1)),
                systemAvgFailureRate: parseFloat(systemAvgFailureRate.toFixed(1)),
                yourTempFailures: failedBatches.filter(b => b.category === 'Temperature-Driven').length,
                systemAvgTempFailures: parseFloat((sysTempFailures / distinctManagers).toFixed(1)),
                yourLongStorage: failedBatches.filter(b => b.category === 'Long Storage').length,
                systemAvgLongStorage: parseFloat((sysLongStorage / distinctManagers).toFixed(1)),
                yourDistributorDelay: failedBatches.filter(b => b.category === 'Distributor Delay').length,
                systemAvgDistributorDelay: parseFloat((sysDistDelay / distinctManagers).toFixed(1))
            },

            availableMonths
        });

    } catch (error) {
        console.error('Error generating root cause analytics:', error);
        res.status(500).json({ error: 'Failed to generate root cause analytics' });
    }
};

const getLiveImpact = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const problemZones = req.query.zones ? req.query.zones.split(',') : [];

        // Query 1: Current batches in problem zones
        let zoneQuery = `
            SELECT 
                b.batch_id, b.product_name, b.sku,
                b.zone_id as zone, b.days_in_warehouse,
                b.risk_category,
                fs.frs_score
            FROM batches b
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            AND fs.calculated_at = (
                SELECT MAX(calculated_at)
                FROM freshness_scores
                WHERE batch_id = b.batch_id
            )
            WHERE b.status NOT IN ('dispatched', 'cleared', 'returned')
        `;
        
        const zoneParams = [];
        if (problemZones.length > 0) {
            zoneQuery += ` AND b.zone_id = ANY($1)`;
            zoneParams.push(problemZones);
        } else {
            // If no problem zones provided, don't return anything for this section
            zoneQuery += ` AND 1=0`;
        }
        zoneQuery += ` ORDER BY fs.frs_score ASC NULLS LAST`;

        const zoneResult = await pool.query(zoneQuery, zoneParams);

        // Query 2: Batches approaching 120 days (threshold)
        const storageQuery = `
            SELECT
                b.batch_id, b.product_name, b.sku,
                b.days_in_warehouse, b.zone_id as zone,
                fs.frs_score
            FROM batches b
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            AND fs.calculated_at = (
                SELECT MAX(calculated_at)
                FROM freshness_scores
                WHERE batch_id = b.batch_id
            )
            WHERE b.days_in_warehouse >= 90
            AND b.status NOT IN ('dispatched', 'cleared', 'returned')
            ORDER BY b.days_in_warehouse DESC
        `;
        const storageResult = await pool.query(storageQuery);

        // Query 3: Current batches waiting for collection
        const delayQuery = `
            SELECT
                dr.dispatch_id,
                b.product_name, b.sku,
                d.distributor_name,
                dr.dispatch_timestamp as dispatched_at,
                EXTRACT(EPOCH FROM (NOW() - dr.dispatch_timestamp)) / 86400 as days_waiting
            FROM dispatch_records dr
            JOIN batches b ON dr.batch_id = b.batch_id
            JOIN distributor_records d ON dr.distributor_id = d.distributor_id
            WHERE dr.approved_by = $1
            AND dr.collected_timestamp IS NULL
            AND b.status = 'dispatched'
            AND dr.dispatch_timestamp <= NOW() - INTERVAL '7 days'
            ORDER BY days_waiting DESC
        `;
        const delayResult = await pool.query(delayQuery, [userId]);

        return res.json({
            atRiskInZones: zoneResult.rows,
            approachingStorageLimit: storageResult.rows,
            collectionDelays: delayResult.rows
        });

    } catch (error) {
        console.error('Error fetching live impact:', error);
        res.status(500).json({ error: 'Failed to fetch live impact data' });
    }
};

module.exports = {
    getRootCauseAnalytics,
    getLiveImpact
};
