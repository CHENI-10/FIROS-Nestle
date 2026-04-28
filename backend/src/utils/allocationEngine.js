const db = require('../config/db');

/**
 * Scores all distributors for a given batch product_id (used as SKU identifier).
 * Returns a ranked list from best to worst.
 */
async function calculateAllocationScores({ batchProductId, distributors }) {
    // Check if any sales rep reports exist at all (for fallback mode detection)
    const totalReportsRes = await db.query(`SELECT COUNT(*) as cnt FROM sales_rep_reports`);
    const fallbackMode = parseInt(totalReportsRes.rows[0].cnt) === 0;

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

        // 2. SALES VELOCITY SCORE — use distributor's own region + batch product_id
        let velocityScore = 50;
        let velocityDefaulted = false;

        if (!fallbackMode) {
            const velRes = await db.query(`
                SELECT AVG(li.movement_score_final) as avg_movement
                FROM sales_rep_reports r
                JOIN report_line_items li ON r.report_id = li.report_id
                WHERE r.region = $1
                  AND li.sku = $2
                  AND r.submitted_at >= NOW() - INTERVAL '30 days'
            `, [dist.region, String(batchProductId)]);

            const avg = velRes.rows[0]?.avg_movement ? parseFloat(velRes.rows[0].avg_movement) : null;

            if (avg === null) {
                velocityScore = 50;
                velocityDefaulted = true;
            } else if (avg >= 2.5) {
                velocityScore = 100;
            } else if (avg >= 1.5) {
                velocityScore = 60;
            } else {
                velocityScore = 20;
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
            allocationScore = (performanceScore * 0.615) + (urgencyScore * 0.385);
        } else {
            allocationScore = (performanceScore * 0.40) + (velocityScore * 0.35) + (urgencyScore * 0.25);
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
