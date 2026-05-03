const db = require('../config/db');

exports.getMarketPulse = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        // Query 1: Current warehouse stock per SKU
        const stockQuery = `
            SELECT 
              p.ean13_barcode as sku,
              p.product_name,
              p.pack_size,
              COUNT(*) as batch_count
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            WHERE b.status NOT IN ('dispatched', 'cleared', 'returned')
            GROUP BY p.ean13_barcode, p.product_name, p.pack_size
        `;
        const { rows: stockData } = await db.query(stockQuery);
        
        const stockMap = {};
        stockData.forEach(s => {
            stockMap[s.sku] = {
                sku: s.sku,
                productName: `${s.product_name} - ${s.pack_size}`,
                batchCount: parseInt(s.batch_count)
            };
        });

        // BACKEND FIX 1 & 2: Grouped High Demand Not In Stock
        const highDemandQuery = `
            SELECT
              li.sku,
              p.product_name,
              p.pack_size,
              STRING_AGG(DISTINCT r.region, ', ' ORDER BY r.region) as fast_regions,
              COUNT(DISTINCT r.region) as region_count
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            JOIN products p ON li.sku = p.ean13_barcode
            WHERE r.submitted_at >= NOW() - INTERVAL '${days} days'
            AND li.sku NOT IN (
              SELECT DISTINCT p2.ean13_barcode
              FROM batches b
              JOIN products p2 ON b.product_id = p2.product_id
              WHERE b.status NOT IN ('dispatched', 'cleared', 'returned')
            )
            GROUP BY li.sku, p.product_name, p.pack_size
            HAVING AVG(li.movement_score_final) >= 2.5
            ORDER BY region_count DESC, p.product_name
        `;
        const { rows: highDemandRows } = await db.query(highDemandQuery);

        // BACKEND FIX 3: Days out of stock
        const skus = highDemandRows.map(r => r.sku);
        let oosData = {};
        if (skus.length > 0) {
            const oosQuery = `
                SELECT
                  p.ean13_barcode as sku,
                  MAX(dr.dispatch_timestamp) as last_dispatched_at,
                  EXTRACT(EPOCH FROM (NOW() - MAX(dr.dispatch_timestamp))) / 86400 as days_since_last_dispatch
                FROM dispatch_records dr
                JOIN batches b ON dr.batch_id = b.batch_id
                JOIN products p ON b.product_id = p.product_id
                WHERE p.ean13_barcode = ANY($1)
                GROUP BY p.ean13_barcode
            `;
            const { rows: oosRows } = await db.query(oosQuery, [skus]);
            oosRows.forEach(r => {
                oosData[r.sku] = parseFloat(r.days_since_last_dispatch);
            });
        }

        const highDemandNotInStock = highDemandRows.map(p => {
            const daysOOS = oosData[p.sku];
            const regionCount = parseInt(p.region_count || 0);
            const urgencyTier = regionCount >= 3 ? 'high' : regionCount === 2 ? 'medium' : 'low';
            const urgencyColor = regionCount >= 3 ? '#ef4444' : regionCount === 2 ? '#f59e0b' : '#94a3b8';
            
            return {
                sku: p.sku || 'N/A',
                productName: `${p.product_name} - ${p.pack_size}`,
                packSize: p.pack_size,
                fast_regions: p.fast_regions || '',
                region_count: regionCount,
                urgency_tier: urgencyTier,
                urgency_color: urgencyColor,
                days_out_of_stock: (daysOOS !== undefined && !isNaN(daysOOS)) ? daysOOS : null,
                batches_available: 0
            };
        });

        // Query 2: Velocity per SKU per region
        const velocityQuery = `
            SELECT 
              r.region,
              li.sku,
              p.product_name,
              p.pack_size,
              AVG(li.movement_score_final)::numeric as avg_score,
              COUNT(CASE WHEN li.is_empty_shelf = true THEN 1 END) as empty_shelf_count
            FROM sales_rep_reports r
            JOIN report_line_items li ON r.report_id = li.report_id
            JOIN products p ON li.sku = p.ean13_barcode
            WHERE r.submitted_at >= NOW() - INTERVAL '${days} days'
            GROUP BY r.region, li.sku, p.product_name, p.pack_size
        `;
        const { rows: velocityData } = await db.query(velocityQuery);

        const allRegions = ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Kurunegala'];
        const skuToRegions = {};
        
        velocityData.forEach(v => {
            if (!skuToRegions[v.sku]) {
                skuToRegions[v.sku] = {
                    sku: v.sku,
                    productName: `${v.product_name} - ${v.pack_size}`,
                    regions: {}
                };
                allRegions.forEach(r => {
                    skuToRegions[v.sku].regions[r] = {
                        region: r,
                        avgScore: null,
                        speed: 'no_data',
                        icon: '—',
                        barWidth: 0,
                        empty_shelf_count: 0
                    };
                });
            }
            const score = parseFloat(v.avg_score);
            const emptyCount = parseInt(v.empty_shelf_count || 0);
            let speed = 'slow';
            let icon = '🐢';
            if (score >= 2.5) { speed = 'fast'; icon = '🔥'; }
            else if (score >= 1.5) { speed = 'normal'; icon = '⚡'; }

            skuToRegions[v.sku].regions[v.region] = {
                region: v.region,
                avgScore: score.toFixed(1),
                speed: speed,
                icon: icon,
                barWidth: Math.min((score / 3.0) * 100, 100),
                empty_shelf_count: emptyCount
            };
        });

        const stockWithVelocity = [];
        
        Object.values(skuToRegions).forEach(item => {
            if (!stockMap[item.sku]) return;

            const regionArray = Object.values(item.regions);
            const fastRegions = regionArray.filter(r => r.speed === 'fast');
            const fastRegionNames = fastRegions.map(r => r.region);
            
            let bestRegion = regionArray[0];
            regionArray.forEach(r => {
                if (r.empty_shelf_count > bestRegion.empty_shelf_count) {
                    bestRegion = r;
                } else if (r.empty_shelf_count === bestRegion.empty_shelf_count) {
                    if (parseFloat(r.avgScore || 0) > parseFloat(bestRegion.avgScore || 0)) {
                        bestRegion = r;
                    }
                }
            });

            const hasEmptyShelf = regionArray.some(r => r.empty_shelf_count > 0);
            const hasFastSpeed = regionArray.some(r => r.speed === 'fast');

            let priority = 'normal';
            let priority_label = 'NORMAL — Dispatch by FRS';
            let priority_color = '#94a3b8';

            if (hasEmptyShelf && hasFastSpeed) {
                priority = 'critical';
                priority_label = 'CRITICAL — Empty shelf reported';
                priority_color = '#ef4444';
            } else if (hasFastSpeed) {
                priority = 'high';
                priority_label = 'HIGH — Fast moving market';
                priority_color = '#f59e0b';
            }

            let alert_text = "";
            const batchCount = stockMap[item.sku].batchCount;
            if (priority === 'critical') {
                alert_text = `${item.productName}: ${bestRegion.region} shelves empty. You have ${batchCount} batch(es) ready. Send to ${bestRegion.region} distributor now.`;
            } else if (priority === 'high') {
                alert_text = `${item.productName} is moving fast in ${fastRegionNames.join(' and ')}. You have ${batchCount} batch(es). Prioritise dispatch to ${bestRegion.region}.`;
            } else {
                alert_text = `No urgent demand signal for ${item.productName}. Dispatch based on FRS score.`;
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

            stockWithVelocity.push({
                sku: item.sku,
                productName: item.productName,
                batchCount: batchCount,
                dispatch_priority: priority,
                priority_label: priority_label,
                priority_color: priority_color,
                best_dispatch_region: bestRegion.region,
                alert_text: alert_text,
                regions: regionArray,
                peakScore: Math.max(...regionArray.map(r => parseFloat(r.avgScore || 0)))
            });
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


