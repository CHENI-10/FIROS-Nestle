const db = require('../config/db');

exports.getMarketPulse = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        // Query 1: Product Movement & Empty Shelves
        const productQuery = `
            SELECT 
                r.region,
                li.sku,
                li.product_name,
                AVG(li.movement_score_final)::numeric as avg_score,
                COUNT(DISTINCT r.report_id)::integer as report_count,
                COUNT(DISTINCT r.sales_rep_id)::integer as rep_count,
                MAX(r.submitted_at) AT TIME ZONE 'UTC' as last_reported,
                SUM(CASE WHEN li.is_empty_shelf THEN 1 ELSE 0 END)::integer as empty_shelf_count
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            WHERE r.submitted_at >= NOW() - INTERVAL '${days} days'
            GROUP BY r.region, li.sku, li.product_name
            ORDER BY r.region, avg_score DESC
        `;
        const { rows: products } = await db.query(productQuery);

        // Query 2: Recent Sales Rep Activity
        const repActivityQuery = `
            SELECT 
                r.region,
                COALESCE(r.rep_name, u.full_name) as rep_name,
                MAX(r.submitted_at) AT TIME ZONE 'UTC' as last_submission
            FROM sales_rep_reports r
            JOIN users u ON r.sales_rep_id = u.user_id
            WHERE r.submitted_at >= NOW() - INTERVAL '${days} days'
            GROUP BY r.region, COALESCE(r.rep_name, u.full_name)
            ORDER BY r.region, last_submission DESC
        `;
        const { rows: repActivities } = await db.query(repActivityQuery);

        // Process data into required structure
        const byRegion = {
            Colombo: { products: [], activities: [] },
            Kandy: { products: [], activities: [] },
            Galle: { products: [], activities: [] },
            Jaffna: { products: [], activities: [] },
            Kurunegala: { products: [], activities: [] }
        };

        const globalStats = {};
        const emptyShelfAlerts = [];

        products.forEach(p => {
            let speed = 'slow';
            if (p.avg_score >= 2.5) speed = 'fast';
            else if (p.avg_score >= 1.5) speed = 'normal';

            const item = {
                sku: p.sku,
                productName: p.product_name,
                avgScore: parseFloat(p.avg_score).toFixed(1),
                speed,
                reportCount: p.report_count,
                repCount: p.rep_count,
                lastReported: p.last_reported,
                emptyShelfCount: p.empty_shelf_count
            };

            if (byRegion[p.region]) {
                byRegion[p.region].products.push(item);
            }

            if (p.empty_shelf_count > 0) {
                emptyShelfAlerts.push({
                    sku: p.sku,
                    productName: p.product_name,
                    region: p.region,
                    emptyShelfCount: p.empty_shelf_count,
                    lastReported: p.last_reported
                });
            }

            // For global top movers
            if (!globalStats[p.sku]) {
                globalStats[p.sku] = {
                    sku: p.sku,
                    productName: p.product_name,
                    totalScore: 0,
                    count: 0,
                    fastInRegions: [],
                    slowInRegions: []
                };
            }
            globalStats[p.sku].totalScore += parseFloat(p.avg_score);
            globalStats[p.sku].count += 1;

            if (speed === 'fast') globalStats[p.sku].fastInRegions.push(p.region);
            if (speed === 'slow') globalStats[p.sku].slowInRegions.push(p.region);
        });

        // Add rep activities
        repActivities.forEach(a => {
            if (byRegion[a.region]) {
                byRegion[a.region].activities.push(a);
            }
        });

        // Calculate global top movers
        const topMoversOverall = Object.values(globalStats)
            .map(g => ({
                ...g,
                avgScoreAllRegions: (g.totalScore / g.count).toFixed(1),
                overallSpeed: (g.totalScore / g.count) >= 2.5 ? 'fast' : ((g.totalScore / g.count) >= 1.5 ? 'normal' : 'slow')
            }))
            .sort((a, b) => parseFloat(b.avgScoreAllRegions) - parseFloat(a.avgScoreAllRegions))
            .slice(0, 5);

        // Generate dispatch suggestions
        const dispatchSuggestions = Object.values(globalStats)
            .filter(g => g.fastInRegions.length > 0)
            .map(g => ({
                sku: g.sku,
                productName: g.productName,
                priorityRegions: g.fastInRegions,
                avoidRegions: g.slowInRegions,
                reason: `Fast moving in ${g.fastInRegions.join(', ')}`
            }));

        res.json({
            generatedAt: new Date(),
            periodDays: days,
            topMoversOverall,
            byRegion,
            emptyShelfAlerts: emptyShelfAlerts.sort((a, b) => b.emptyShelfCount - a.emptyShelfCount),
            dispatchSuggestions
        });
    } catch (error) {
        console.error("Error generating market pulse:", error);
        res.status(500).json({ message: 'Server error generating market pulse' });
    }
};
