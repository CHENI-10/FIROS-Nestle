const db = require('../config/db');

/**
 * Scores all distributors for a given batch product_id (used as SKU identifier).
 * Returns a ranked list from best to worst.
 */
async function calculateAllocationScores({ batchProductId, distributors }) {
    // Check if any sales rep reports exist at all (for fallback mode detection)
    const totalReportsRes = await db.query(`SELECT COUNT(*) as cnt FROM sales_rep_reports`);
    const fallbackMode = parseInt(totalReportsRes.rows[0].cnt) === 0;

    // Resolve the actual SKU/Barcode for this product once to match rep reports
    const productRes = await db.query(`SELECT ean13_barcode FROM products WHERE product_id = $1`, [batchProductId]);
    const targetSku = productRes.rows[0]?.ean13_barcode || String(batchProductId);

    const scored = await Promise.all(distributors.map(async (dist) => {
        // 1. PERFORMANCE SCORE from distributor_scorecards
        const perfRes = await db.query(`
            SELECT performance_score as overall_score
            FROM distributor_scorecards
            WHERE distributor_id = $1
            ORDER BY last_updated_at DESC
            LIMIT 1
        `, [dist.distributor_id]);
        const performanceScore = perfRes.rows.length > 0
            ? parseFloat(perfRes.rows[0].overall_score)
            : 50;

        // 2. SALES VELOCITY SCORE — strictly product-specific
        let velocityScore = 50;
        let velocityDefaulted = false;
        let isOOS = false;

        if (!fallbackMode) {
            // Get product category first for fallback
            const catRes = await db.query(`SELECT category FROM report_line_items WHERE sku = $1 LIMIT 1`, [targetSku]);
            const category = catRes.rows[0]?.category;

            const velRes = await db.query(`
                SELECT 
                    AVG(li.movement_score_final) as avg_movement,
                    COUNT(CASE 
                        WHEN li.shelf_availability = 'out_of_stock' 
                        OR (li.is_empty_shelf = true AND (li.empty_shelf_reason = 'sold_out' OR li.empty_shelf_reason IS NULL))
                        THEN 1 END) as demand_surge_count,
                    (SELECT AVG(li2.movement_score_final) 
                     FROM sales_rep_reports r2
                     JOIN report_line_items li2 ON r2.report_id = li2.report_id
                     WHERE r2.region = $1 AND li2.category = $3
                     AND r2.submitted_at >= NOW() - INTERVAL '30 days') as cat_avg
                FROM sales_rep_reports r
                JOIN report_line_items li ON r.report_id = li.report_id
                WHERE r.region = $1
                  AND li.sku = $2
                  AND r.submitted_at >= NOW() - INTERVAL '30 days'
            `, [dist.region, targetSku, category]);

            const avg = velRes.rows[0]?.avg_movement ? parseFloat(velRes.rows[0].avg_movement) : null;
            const catAvg = velRes.rows[0]?.cat_avg ? parseFloat(velRes.rows[0].cat_avg) : null;
            const demandSurgeCount = parseInt(velRes.rows[0]?.demand_surge_count || 0);

            if (demandSurgeCount > 0) {
                velocityScore = 100; // Priority 1: High Demand Stock out for THIS specific product
                isOOS = true;
            } else if (avg !== null) {
                velocityScore = avg >= 2.5 ? 100 : (avg >= 1.5 ? 70 : 30);
            } else if (catAvg !== null) {
                // FALLBACK: Category Velocity boost
                velocityScore = catAvg >= 2.5 ? 85 : (catAvg >= 1.5 ? 60 : 25);
            } else {
                velocityScore = 50;
                velocityDefaulted = true;
            }
        }

        // 3. VISIT URGENCY SCORE
        let urgencyScore = 50;
        if (dist.next_visit_date) {
            const today = new Date();
            const visitDate = new Date(dist.next_visit_date);
            const days = Math.round((visitDate - today) / (1000 * 60 * 60 * 24));
            if (days <= 0) {
                urgencyScore = 100; // overdue visit
            } else {
                urgencyScore = Math.max(0, Math.min(100, 100 - days));
            }
        }

        // 4. ALLOCATION SCORE
        let allocationScore;
        if (fallbackMode) {
            allocationScore = (performanceScore * 0.60) + (urgencyScore * 0.40);
        } else {
            allocationScore = (performanceScore * 0.30) + (velocityScore * 0.50) + (urgencyScore * 0.20);
        }

        return {
            distributorId: dist.distributor_id,
            distributorName: dist.distributor_name,
            distributorRegion: dist.region,
            allocationScore: parseFloat(allocationScore.toFixed(2)),
            breakdown: {
                performanceScore: parseFloat(performanceScore.toFixed(1)),
                velocityScore: parseFloat(velocityScore.toFixed(1)),
                urgencyScore: parseFloat(urgencyScore.toFixed(1)),
                velocityDefaulted,
                isOOS,
                fallbackMode
            },
            isRecommended: false
        };
    }));

    // Sort: allocationScore DESC → performanceScore DESC → distributorId ASC (consistent tiebreak)
    scored.sort((a, b) => {
        if (b.allocationScore !== a.allocationScore) return b.allocationScore - a.allocationScore;
        if (b.breakdown.performanceScore !== a.breakdown.performanceScore) return b.breakdown.performanceScore - a.breakdown.performanceScore;
        return a.distributorId - b.distributorId; // stable final tiebreak
    });

    if (scored.length > 0) {
        scored[0].isRecommended = true;
    }

    return scored;
}

/**
 * Multi-batch allocation: assigns distributors avoiding conflicts.
 * Most urgent batch (lowest FRS) gets best available distributor.
 */
async function resolveMultiBatchAllocation(batches) {
    if (!batches || batches.length === 0) return [];

    // Fetch all distributors once
    const distRes = await db.query(`
        SELECT distributor_id, distributor_name, region, next_visit_date
        FROM distributor_records
        ORDER BY distributor_id
    `);
    const distributors = distRes.rows;

    // Sort batches by FRS ascending (most urgent first)
    const sorted = [...batches].sort((a, b) => parseFloat(a.batchFrs) - parseFloat(b.batchFrs));

    const allocatedSet = new Set();
    const results = [];

    for (const batch of sorted) {
        const ranked = await calculateAllocationScores({
            batchProductId: batch.batchProductId,
            distributors
        });

        // Pick highest-scored distributor not yet allocated
        let picked = null;
        let allocationRank = 1;
        for (const candidate of ranked) {
            if (!allocatedSet.has(candidate.distributorId)) {
                picked = candidate;
                break;
            }
            allocationRank++;
        }

        // If all allocated (more batches than distributors), reset and allow re-use
        if (!picked) {
            allocatedSet.clear();
            picked = ranked[0];
            allocationRank = 1;
            console.warn(`[AllocationEngine] All distributors already allocated for batch ${batch.batchId}. Resetting set.`);
        }

        allocatedSet.add(picked.distributorId);

        results.push({
            batchId: batch.batchId,
            batchSku: batch.batchSku,
            batchFrs: batch.batchFrs,
            recommendedDistributor: {
                distributorId: picked.distributorId,
                distributorName: picked.distributorName,
                distributorRegion: picked.distributorRegion,
                allocationScore: picked.allocationScore,
                breakdown: picked.breakdown
            },
            allocationRank
        });
    }

    return results;
}

module.exports = { calculateAllocationScores, resolveMultiBatchAllocation };
