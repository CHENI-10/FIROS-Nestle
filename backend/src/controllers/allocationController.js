const db = require('../config/db');
const { calculateAllocationScores, resolveMultiBatchAllocation } = require('../utils/allocationEngine');

/**
 * GET /api/allocation/:batchId
 * Returns ranked distributor list for a single batch
 */
exports.getAllocationForBatch = async (req, res) => {
    try {
        const { batchId } = req.params;

        // Fetch batch with product info (product_id used as SKU identifier)
        const batchRes = await db.query(`
            SELECT b.batch_id, b.product_id, p.product_name, fs.frs_score
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.batch_id = $1
        `, [batchId]);

        if (batchRes.rows.length === 0) {
            return res.status(404).json({ message: 'Batch not found' });
        }

        const batch = batchRes.rows[0];

        // Fetch all distributors
        const distRes = await db.query(`
            SELECT distributor_id, distributor_name, region, next_visit_date
            FROM distributor_records
            ORDER BY distributor_id
        `);

        const ranked = await calculateAllocationScores({
            batchProductId: batch.product_id,
            distributors: distRes.rows
        });

        const recommendation = ranked[0] || null;
        const allDistributors = ranked.map(d => ({
            distributorId: d.distributorId,
            distributorName: d.distributorName,
            distributorRegion: d.distributorRegion,
            allocationScore: d.allocationScore
        }));

        res.json({
            batchId: batch.batch_id,
            batchSku: String(batch.product_id),
            batchProductName: batch.product_name,
            batchFrs: batch.frs_score,
            recommendation: recommendation ? {
                distributorId: recommendation.distributorId,
                distributorName: recommendation.distributorName,
                distributorRegion: recommendation.distributorRegion,
                allocationScore: recommendation.allocationScore,
                breakdown: recommendation.breakdown
            } : null,
            allDistributors
        });

    } catch (error) {
        console.error('Error in getAllocationForBatch:', error);
        res.status(500).json({ message: 'Server error computing allocation' });
    }
};

/**
 * GET /api/allocation/batch-queue
 * Returns allocation recommendations for ALL current high-risk batches
 */
exports.getBatchQueue = async (req, res) => {
    try {
        const batchesRes = await db.query(`
            SELECT b.batch_id, b.product_id, p.product_name, fs.frs_score
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.status = 'in_storage'
              AND fs.risk_band = 'high'
            ORDER BY fs.frs_score ASC
        `);

        if (batchesRes.rows.length === 0) {
            return res.json([]);
        }

        const batches = batchesRes.rows.map(b => ({
            batchId: b.batch_id,
            batchSku: String(b.product_id),
            batchProductName: b.product_name,
            batchFrs: b.frs_score,
            batchProductId: b.product_id
        }));

        const results = await resolveMultiBatchAllocation(batches);
        res.json(results);

    } catch (error) {
        console.error('Error in getBatchQueue:', error);
        res.status(500).json({ message: 'Server error fetching batch queue' });
    }
};

/**
 * PATCH /api/allocation/:batchId/confirm
 * Logs the allocation decision and marks batch as cleared
 */
exports.confirmAllocation = async (req, res) => {
    const client = await db.connect();
    try {
        const { batchId } = req.params;
        const {
            chosenDistributorId,
            recommendedDistributorId,
            overrideReason,
            allocationScore,
            breakdown,
            clearanceReason,
            discountApplied
        } = req.body;

        const userId = req.user?.user_id || req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!chosenDistributorId) return res.status(400).json({ message: 'chosenDistributorId is required' });

        const managerOverrode = parseInt(chosenDistributorId) !== parseInt(recommendedDistributorId);

        // Validate batch
        const batchRes = await client.query(`SELECT status, zone_id FROM batches WHERE batch_id = $1`, [batchId]);
        if (batchRes.rows.length === 0) return res.status(404).json({ message: 'Batch not found' });
        if (batchRes.rows[0].status !== 'in_storage') {
            return res.status(400).json({ message: 'Batch is already processed' });
        }

        // Fetch FRS for logging
        const frsRes = await client.query(`SELECT frs_score, risk_band FROM freshness_scores WHERE batch_id = $1`, [batchId]);
        const frs = frsRes.rows[0]?.frs_score || 0;
        const riskBand = frsRes.rows[0]?.risk_band || 'high';
        const zoneId = batchRes.rows[0].zone_id;

        await client.query('BEGIN');

        // Insert dispatch record with full allocation metadata
        const dispatchRes = await client.query(`
            INSERT INTO dispatch_records (
                batch_id, distributor_id, frs_at_dispatch, risk_band_at_dispatch,
                zone_at_dispatch, approved_by, dispatch_timestamp,
                recommended_distributor_id, allocation_score, allocation_breakdown,
                manager_overrode, override_reason
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11)
            RETURNING dispatch_id
        `, [
            batchId, chosenDistributorId, frs, riskBand, zoneId, userId,
            recommendedDistributorId || null,
            allocationScore || null,
            breakdown ? JSON.stringify(breakdown) : null,
            managerOverrode,
            overrideReason || null
        ]);

        const dispatchId = dispatchRes.rows[0].dispatch_id;

        // Also insert into clearance_records to keep clearance ledger consistent
        const finalReason = clearanceReason || 'Smart Allocation — Clearance dispatch';
        await client.query(`
            INSERT INTO clearance_records (batch_id, reason, approved_by, cleared_at, distributor_id, discount_applied)
            VALUES ($1, $2, $3, NOW(), $4, $5)
        `, [batchId, finalReason, userId, chosenDistributorId, discountApplied || null]);

        // Update batch status to cleared
        await client.query(`UPDATE batches SET status = 'cleared' WHERE batch_id = $1`, [batchId]);

        // Close batch zone history
        await client.query(`
            UPDATE batch_zone_history SET exit_timestamp = NOW()
            WHERE batch_id = $1 AND exit_timestamp IS NULL
        `, [batchId]);

        await client.query('COMMIT');

        res.json({ success: true, dispatchId, managerOverrode });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in confirmAllocation:', error);
        res.status(500).json({ message: 'Server error confirming allocation' });
    } finally {
        client.release();
    }
};
