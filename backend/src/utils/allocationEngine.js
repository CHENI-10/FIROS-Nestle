const db = require('../config/db');

/**
 * Scores all distributors for a given batch product_id (used as SKU identifier).
 * Returns a ranked list from best to worst.
 */
async function calculateAllocationScores({ batchProductId, distributors, riskBand = 'high' }) {
    // Check if any sales rep reports exist at all (for fallback mode detection)
    const totalReportsRes = await db.query(`SELECT COUNT(*) as cnt FROM sales_rep_reports`);
    const fallbackMode = parseInt(totalReportsRes.rows[0].cnt) === 0;

    // Get the most likely SKU/Barcode for this product
    const prodInfoRes = await db.query(`SELECT ean13_barcode, product_name FROM products WHERE product_id = $1`, [batchProductId]);
    const prodRow = prodInfoRes.rows[0];
    const targetSku = prodRow?.ean13_barcode || String(batchProductId);
    const productName = prodRow?.product_name || '';

    const scored = await Promise.all(distributors.map(async (dist) => {
        // 1. PERFORMANCE SCORE
        const perfRes = await db.query(`
            SELECT performance_score as overall_score
            FROM distributor_scorecards
            WHERE distributor_id = $1
            ORDER BY last_updated_at DESC
            LIMIT 1
        `, [dist.distributor_id]);
        const performanceScore = perfRes.rows.length > 0 ? parseFloat(perfRes.rows[0].overall_score) : 50;

        // 2. SALES VELOCITY / DEMO DATA
        let velocityScore = 50;
        let isOOS = false;

        if (!fallbackMode) {
            const brandName = productName.split(' ')[0];
            const velRes = await db.query(`
                SELECT 
                    AVG(li.movement_score_final) as avg_movement,
                    SUM(CASE 
                        WHEN (li.sku = $2 OR li.product_name ILIKE $3) 
                        AND (li.shelf_availability = 'out_of_stock' 
                        OR (li.is_empty_shelf = true AND (li.empty_shelf_reason = 'sold_out' OR li.empty_shelf_reason IS NULL)))
                        THEN (CASE WHEN r.submitted_at >= NOW() - INTERVAL '48 hours' THEN 5 ELSE 1 END)
                        ELSE 0 END) as weighted_oos_score,
                    (SELECT AVG(li2.movement_score_final) FROM sales_rep_reports r2
                     JOIN report_line_items li2 ON r2.report_id = li2.report_id
                     WHERE r2.region ILIKE $1 AND (li2.product_name ILIKE $3)
                     AND r2.submitted_at >= NOW() - INTERVAL '30 days') as cat_avg
                FROM sales_rep_reports r
                JOIN report_line_items li ON r.report_id = li.report_id
                WHERE r.region ILIKE $1
                  AND r.submitted_at >= NOW() - INTERVAL '30 days'
            `, [`%${dist.region}%`, targetSku, `%${brandName}%`]);

            const avg = velRes.rows[0]?.avg_movement ? parseFloat(velRes.rows[0].avg_movement) : null;
            const catAvg = velRes.rows[0]?.cat_avg ? parseFloat(velRes.rows[0].cat_avg) : null;
            const weightedOosScore = parseFloat(velRes.rows[0]?.weighted_oos_score || 0);

            if (weightedOosScore > 0) {
                // RECENCY-WEIGHTED EMERGENCY: Fresh reports (last 48h) count for 5x more.
                // No cap—the worse the emergency, the higher the score.
                velocityScore = 100 + (weightedOosScore * 5); 
                isOOS = true;
            } else if (avg !== null) {
                velocityScore = avg >= 2.5 ? 100 : (avg >= 1.5 ? 70 : 30);
            } else if (catAvg !== null) {
                velocityScore = catAvg >= 2.5 ? 85 : (catAvg >= 1.5 ? 60 : 25);
            }
        }

        // 3. VISIT URGENCY
        let urgencyScore = 50;
        if (dist.next_visit_date) {
            const days = Math.round((new Date(dist.next_visit_date) - new Date()) / (1000 * 60 * 60 * 24));
            urgencyScore = days <= 0 ? 100 : Math.max(0, Math.min(100, 100 - days));
        }

        return {
            distId: dist.distributor_id,
            distName: dist.distributor_name,
            region: dist.region,
            scores: { performanceScore, velocityScore, urgencyScore, isOOS }
        };
    }));

    // Check if there's any OOS for Medium Risk batches
    const anyOOS = scored.some(s => s.scores.isOOS);

    const finalized = scored.map(s => {
        let allocationScore;
        const { performanceScore, velocityScore, urgencyScore, isOOS } = s.scores;

        if (riskBand === 'medium' && !anyOOS) {
            // STANDARD MODE: No empty shelf? Just follow visit schedule (100% Urgency)
            allocationScore = urgencyScore;
        } else {
            // EMERGENCY BOOST: MASSIVE +50 BONUS for Stockouts
            if (isOOS) {
                // In an emergency, history (performance) matters very little (5%) 
                // compared to the immediate need (80%)
                allocationScore = (performanceScore * 0.05) + (velocityScore * 0.80) + (urgencyScore * 0.15);
                allocationScore += 50; // NUCLEAR OPTION: +50 Emergency Bonus
            } else {
                allocationScore = (performanceScore * 0.30) + (velocityScore * 0.50) + (urgencyScore * 0.20);
            }
        }

        return {
            distributorId: s.distId,
            distributorName: s.distName,
            distributorRegion: s.region,
            allocationScore: parseFloat(allocationScore.toFixed(2)),
            breakdown: { ...s.scores, fallbackMode, anyOOS },
            isRecommended: false
        };
    });

    // Rank based on the raw score (which can now exceed 100 for emergencies)
    finalized.sort((a, b) => b.allocationScore - a.allocationScore || b.breakdown.performanceScore - a.breakdown.performanceScore);
    
    // Now cap the final display scores to 100
    finalized.forEach(f => {
        f.allocationScore = Math.min(100, f.allocationScore);
    });

    if (finalized.length > 0) finalized[0].isRecommended = true;
    return finalized;
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
            distributors,
            riskBand: batch.riskBand || 'high'
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
