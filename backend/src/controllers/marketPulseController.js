const db = require('../config/db');

exports.getMarketPulse = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        // Query 1: Current warehouse stock per SKU
        const stockQuery = `
            SELECT 
              p.ean13_barcode as sku,
              p.product_name,
              COUNT(*) as batch_count
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            WHERE b.status NOT IN ('dispatched', 'cleared', 'returned')
            GROUP BY p.ean13_barcode, p.product_name
        `;
        const { rows: stockData } = await db.query(stockQuery);
        
        const stockMap = {};
        stockData.forEach(s => {
            stockMap[s.sku] = {
                sku: s.sku,
                productName: s.product_name,
                batchCount: parseInt(s.batch_count)
            };
        });

        // Query 2: Velocity per SKU per region
        const velocityQuery = `
            SELECT 
              r.region,
              li.sku,
              li.product_name,
              AVG(li.movement_score_final)::numeric as avg_score
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            WHERE r.submitted_at >= NOW() - INTERVAL '${days} days'
            GROUP BY r.region, li.sku, li.product_name
        `;
        const { rows: velocityData } = await db.query(velocityQuery);

        const allRegions = ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Kurunegala'];
        const skuToRegions = {};
        
        velocityData.forEach(v => {
            if (!skuToRegions[v.sku]) {
                skuToRegions[v.sku] = {
                    sku: v.sku,
                    productName: v.product_name,
                    regions: {}
                };
                allRegions.forEach(r => {
                    skuToRegions[v.sku].regions[r] = {
                        region: r,
                        avgScore: null,
                        speed: 'no_data',
                        icon: '—',
                        barWidth: 0
                    };
                });
            }
            const score = parseFloat(v.avg_score);
            let speed = 'slow';
            let icon = '🐢';
            if (score >= 2.5) { speed = 'fast'; icon = '🔥'; }
            else if (score >= 1.5) { speed = 'normal'; icon = '⚡'; }

            skuToRegions[v.sku].regions[v.region] = {
                region: v.region,
                avgScore: score.toFixed(1),
                speed: speed,
                icon: icon,
                barWidth: Math.min((score / 3.0) * 100, 100)
            };
        });

        stockData.forEach(s => {
            if (!skuToRegions[s.sku]) {
                skuToRegions[s.sku] = {
                    sku: s.sku,
                    productName: s.product_name,
                    regions: {}
                };
                allRegions.forEach(r => {
                    skuToRegions[s.sku].regions[r] = {
                        region: r,
                        avgScore: null,
                        speed: 'no_data',
                        icon: '—',
                        barWidth: 0
                    };
                });
            }
        });

        const stockWithVelocity = [];
        const highDemandNotInStock = [];
        
        Object.values(skuToRegions).forEach(item => {
            const regionArray = Object.values(item.regions);
            const fastRegions = regionArray.filter(r => r.speed === 'fast');
            fastRegions.sort((a,b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));
            const fastRegionNames = fastRegions.map(r => r.region);
            
            const validScores = regionArray.map(r => r.avgScore).filter(s => s !== null).map(s => parseFloat(s));
            const peakScore = validScores.length > 0 ? Math.max(...validScores) : 0;
            
            let recommendation = "";
            if (fastRegionNames.length >= 2) {
                recommendation = `Send to ${fastRegionNames[0]} or ${fastRegionNames[1]} first — both showing fast movement.`;
            } else if (fastRegionNames.length === 1) {
                recommendation = `Send to ${fastRegionNames[0]} first — fastest moving market for this SKU.`;
            } else if (validScores.length > 0 && validScores.every(s => s < 1.5)) {
                recommendation = "No region showing strong demand for this SKU right now. Dispatch based on FRS urgency.";
            } else if (validScores.length > 0) {
                recommendation = "No region showing strong demand for this SKU right now. Dispatch based on FRS urgency.";
            } else {
                recommendation = "No recent field reports for this SKU. Dispatch based on distributor performance score.";
            }

            const speedOrder = { 'fast': 1, 'normal': 2, 'slow': 3, 'no_data': 4 };
            regionArray.sort((a, b) => {
                if (speedOrder[a.speed] !== speedOrder[b.speed]) return speedOrder[a.speed] - speedOrder[b.speed];
                if (b.avgScore !== a.avgScore) {
                    if (a.avgScore === null) return 1;
                    if (b.avgScore === null) return -1;
                    return parseFloat(b.avgScore) - parseFloat(a.avgScore);
                }
                return a.region.localeCompare(b.region);
            });

            if (stockMap[item.sku]) {
                stockWithVelocity.push({
                    sku: item.sku,
                    productName: item.productName,
                    batchCount: stockMap[item.sku].batchCount,
                    regions: regionArray,
                    recommendation,
                    peakScore
                });
            } else {
                if (fastRegionNames.length > 0) {
                    highDemandNotInStock.push({
                        sku: item.sku,
                        productName: item.productName,
                        fastRegions: fastRegionNames
                    });
                }
            }
        });

        stockWithVelocity.sort((a, b) => b.peakScore - a.peakScore);

        const regionStats = {};
        allRegions.forEach(r => {
            regionStats[r] = { totalScore: 0, count: 0 };
        });
        
        velocityData.forEach(v => {
            if (regionStats[v.region]) {
                regionStats[v.region].totalScore += parseFloat(v.avg_score);
                regionStats[v.region].count += 1;
            }
        });

        const regionOverview = allRegions.map(r => {
            const stats = regionStats[r];
            const avg = stats.count > 0 ? (stats.totalScore / stats.count) : 0;
            let demand = 'low';
            let icon = '🐢';
            let label = 'Low demand';
            if (avg >= 2.5) { demand = 'high'; icon = '🔥'; label = 'High demand overall'; }
            else if (avg >= 1.5) { demand = 'moderate'; icon = '⚡'; label = 'Moderate demand'; }

            return {
                region: r,
                overallDemand: demand,
                avgScore: avg.toFixed(1),
                icon: icon,
                label: label
            };
        });

        res.json({
            generatedAt: new Date(),
            lastUpdated: new Date(),
            regionOverview,
            stockWithVelocity,
            highDemandNotInStock
        });

    } catch (error) {
        console.error("Error generating market pulse:", error);
        res.status(500).json({ message: 'Server error generating market pulse' });
    }
};
