const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Apply auth middleware to all routes
router.use(verifyToken);

// ROUTE 1: GET /
// Returns complete dashboard data in one call
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                b.batch_id,
                b.zone_id,
                b.quantity,
                b.manufacturing_date,
                b.expiry_date,
                b.arrival_timestamp,
                b.status,
                p.product_name,
                p.pack_size,
                p.temp_sensitivity_weight,
                p.humidity_sensitivity_weight,
                fs.frs_score,
                fs.risk_band,
                fs.days_in_warehouse,
                fs.slr_percent_raw,
                fs.total_temp_breach_windows,
                fs.total_humidity_breach_windows,
                fs.last_calculated_at
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            ORDER BY 
                CASE WHEN b.status = 'in_storage' THEN 0 ELSE 1 END ASC,
                fs.frs_score ASC
        `;

        const result = await pool.query(query);
        const batches = result.rows;

        let totalFrs = 0;
        let frsCount = 0;
        let high_risk_count = 0;
        let medium_risk_count = 0;
        let low_risk_count = 0;
        let total_in_storage = 0;

        batches.forEach(batch => {
            if (batch.status === 'in_storage') {
                total_in_storage++;
                if (batch.frs_score !== null && batch.frs_score !== undefined) {
                    totalFrs += Number(batch.frs_score);
                    frsCount++;
                }
                if (batch.risk_band === 'high') high_risk_count++;
                if (batch.risk_band === 'medium') medium_risk_count++;
                if (batch.risk_band === 'low') low_risk_count++;
            }
        });

        const overall_freshness_percent = frsCount > 0 ? Math.round(totalFrs / frsCount) : 0;
        const total_batches = total_in_storage;

        // Return complete dashboard data
        res.json({
            batches,
            overall_freshness_percent,
            total_batches,
            high_risk_count,
            medium_risk_count,
            low_risk_count
        });
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).json({ error: 'Server error fetching dashboard data' });
    }
});

// ROUTE 2: GET /zones
// Returns staleness status for all 4 zones
router.get('/zones', async (req, res) => {
    try {
        const query = `
            SELECT zone_id, zone_name, last_reading_at,
                   EXTRACT(EPOCH FROM (NOW() - last_reading_at)) / 60 AS minutes_since_reading
            FROM warehouse_zones
            ORDER BY zone_id
        `;
        const result = await pool.query(query);

        const zones = result.rows.map(zone => {
            let minutes_since_reading = zone.minutes_since_reading ? Math.floor(zone.minutes_since_reading) : null;
            let is_stale = true;

            if (minutes_since_reading !== null) {
                // Stale if reading is more than 60 minutes ago
                is_stale = minutes_since_reading > 60;
            }

            return {
                ...zone,
                is_stale,
                minutes_since_reading
            };
        });

        res.json(zones);
    } catch (err) {
        console.error('Error fetching zones data:', err);
        res.status(500).json({ error: 'Server error fetching zones data' });
    }
});

// ROUTE 3: GET /alerts
// Returns all unread alerts ordered by newest first
router.get('/alerts', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.alert_id,
                a.batch_id,
                a.alert_type,
                a.risk_band,
                a.message,
                a.is_read,
                a.created_at,
                p.product_name,
                b.zone_id
            FROM alert_records a
            JOIN batches b ON a.batch_id = b.batch_id
            JOIN products p ON b.product_id = p.product_id
            WHERE a.is_read = false
            ORDER BY a.created_at DESC
            LIMIT 20
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching alerts:', err);
        res.status(500).json({ error: 'Server error fetching alerts' });
    }
});

// ROUTE 4.5: GET /distributors
// Returns master list of all authorized distributors
router.get('/distributors', async (req, res) => {
    try {
        const query = `
            SELECT distributor_id, distributor_name, region, contact_person, phone, next_visit_date
            FROM distributor_records
            ORDER BY distributor_name ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching distributors:', err);
        res.status(500).json({ error: 'Server error fetching distributors' });
    }
});

// ROUTE 4: GET /expiry-timeline
// Returns batches expiring within 30 days
router.get('/expiry-timeline', async (req, res) => {
    try {
        const query = `
            SELECT
                b.batch_id,
                b.expiry_date,
                b.zone_id,
                p.product_name,
                p.pack_size,
                fs.frs_score,
                fs.risk_band,
                (b.expiry_date - CURRENT_DATE) as days_until_expiry
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.status = 'in_storage'
            AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
            ORDER BY b.expiry_date ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching expiry timeline:', err);
        res.status(500).json({ error: 'Server error fetching expiry timeline' });
    }
});

// ROUTE 5: GET /recommendations
// Returns intelligent dispatch recommendations based on FRS risk bands
router.get('/recommendations', async (req, res) => {
    try {
        const queryBatches = `
            SELECT 
                b.batch_id, b.zone_id, b.expiry_date, b.arrival_timestamp, b.quantity,
                p.product_name, p.pack_size,
                fs.frs_score, fs.risk_band, fs.days_in_warehouse,
                fs.total_temp_breach_windows, fs.total_humidity_breach_windows
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.status = 'in_storage'
            ORDER BY fs.frs_score ASC
        `;
        const resultBatches = await pool.query(queryBatches);
        const batches = resultBatches.rows;

        const queryDistributors = `
            SELECT distributor_id, distributor_name, next_visit_date
            FROM distributor_records
            WHERE next_visit_date IS NOT NULL
            ORDER BY next_visit_date ASC
        `;
        const resultDistributors = await pool.query(queryDistributors);
        const distributors = resultDistributors.rows;

        // Fetch last assigned distributor for persistent round-robin
        const queryLastDispatch = `
            SELECT distributor_id 
            FROM dispatch_records 
            ORDER BY dispatch_timestamp DESC 
            LIMIT 1
        `;
        const resultLastDispatch = await pool.query(queryLastDispatch);
        let distIndex = 0;

        if (resultLastDispatch.rows.length > 0 && distributors.length > 0) {
            const lastDistId = resultLastDispatch.rows[0].distributor_id;
            const lastIndex = distributors.findIndex(d => d.distributor_id === lastDistId);
            if (lastIndex !== -1) {
                distIndex = (lastIndex + 1) % distributors.length;
            }
        }

        const high_risk = [];
        const medium_risk = [];
        const low_risk = [];

        batches.forEach(batch => {
            const risk_band = batch.risk_band;
            let urgency_score = Math.min((batch.days_in_warehouse || 0) / 30, 5);

            let suggested_distributor_id = null;
            let suggested_distributor_name = null;
            let suggested_next_visit_date = null;

            if (distributors.length > 0) {
                const dist = distributors[distIndex % distributors.length];
                suggested_distributor_id = dist.distributor_id;
                suggested_distributor_name = dist.distributor_name;
                suggested_next_visit_date = dist.next_visit_date;
                distIndex++;
            }

            let recommendationObj = {
                ...batch,
                urgency_score,
                suggested_distributor_id,
                suggested_distributor_name,
                suggested_next_visit_date
            };

            if (risk_band === 'high') {
                recommendationObj.action = 'CLEARANCE';
                recommendationObj.priority = 1;
                recommendationObj.recommendation = 'Remove from dispatch queue. Transfer to Clearance Hub for dynamic promotion calculation and distributor assignment. Manager must approve clearance.';
                recommendationObj.badge_color = 'red';
                recommendationObj.badge_text = 'HIGH RISK — CLEARANCE';
                high_risk.push(recommendationObj);
            } else if (risk_band === 'medium') {
                recommendationObj.action = 'PRIORITY_DISPATCH';
                recommendationObj.priority = 2;
                recommendationObj.recommendation = 'Priority dispatch recommended. Move to top of dispatch queue. Assign to fastest available distributor. Manager must approve dispatch.';
                recommendationObj.badge_color = 'amber';
                recommendationObj.badge_text = 'MEDIUM RISK — PRIORITY DISPATCH';
                medium_risk.push(recommendationObj);
            } else if (risk_band === 'low') {
                recommendationObj.action = 'NORMAL_DISPATCH';
                recommendationObj.priority = 3;
                recommendationObj.recommendation = 'Normal FEFO dispatch. Batch is in good condition. Include in standard dispatch queue ordered by expiry date.';
                recommendationObj.badge_color = 'green';
                recommendationObj.badge_text = 'LOW RISK — NORMAL DISPATCH';
                low_risk.push(recommendationObj);
            }
        });

        // High risk: sort by urgency_score DESC (most urgent clearance first)
        high_risk.sort((a, b) => b.urgency_score - a.urgency_score);

        // Sort Medium Risk batches by expiry_date ASC first, then urgency_score DESC
        medium_risk.sort((a, b) => {
            const dateA = new Date(a.expiry_date).getTime();
            const dateB = new Date(b.expiry_date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return b.urgency_score - a.urgency_score;
        });

        // Then Low Risk batches by expiry_date ASC, then urgency_score DESC
        low_risk.sort((a, b) => {
            const dateA = new Date(a.expiry_date).getTime();
            const dateB = new Date(b.expiry_date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return b.urgency_score - a.urgency_score;
        });

        // dispatch_queue: medium risk + low risk combined, medium first then low
        const dispatch_queue = [...medium_risk, ...low_risk];

        res.json({
            high_risk,
            medium_risk,
            low_risk,
            dispatch_queue,
            total_in_queue: dispatch_queue.length,
            total_clearance: high_risk.length,
            distributors // Raw list mapped to the frontend
        });
    } catch (err) {
        console.error('Error fetching recommendations:', err);
        res.status(500).json({ error: 'Server error fetching recommendations' });
    }
});

// ROUTE 5.5: POST /recommendations/action
// Processes dispatch or clearance action, saving to DB and updating batch status
// RBAC: Only admin and manager can approve dispatches/clearances
router.post('/recommendations/action', requireRole('admin', 'manager'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { batch_id, action_type, distributor_id, reason, discount_applied } = req.body;
        const user_id = req.user?.user_id || req.user?.id;
        if (!user_id) return res.status(401).json({ error: 'Unauthorized' });

        // Audit log
        console.log(`[AUDIT] User ${req.user.email} (${req.user.role}) performing ${action_type} on batch ${batch_id}`);

        if (!batch_id || !action_type) {
            return res.status(400).json({ error: 'Missing batch_id or action_type' });
        }

        await client.query('BEGIN');

        // Fetch current batch details
        const batchQuery = `
            SELECT b.zone_id, b.status, fs.frs_score, fs.risk_band
            FROM batches b
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.batch_id = $1
        `;
        const batchRes = await client.query(batchQuery, [batch_id]);

        if (batchRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }

        const batch = batchRes.rows[0];

        if (batch.status !== 'in_storage') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Batch is already processed' });
        }

        if (action_type === 'dispatch') {
            if (!distributor_id) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'distributor_id is required for dispatch' });
            }

            // Insert into dispatch_records
            await client.query(`
                INSERT INTO dispatch_records 
                (batch_id, distributor_id, frs_at_dispatch, risk_band_at_dispatch, zone_at_dispatch, approved_by, dispatch_timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [batch_id, distributor_id, batch.frs_score || 0, batch.risk_band || 'low', batch.zone_id, user_id]);

            // Update batch status
            await client.query(`UPDATE batches SET status = 'dispatched' WHERE batch_id = $1`, [batch_id]);

        } else if (action_type === 'clearance') {
            // Insert into clearance_records
            const finalReason = reason || 'Manager-approved clearance';
            await client.query(`
                INSERT INTO clearance_records (batch_id, reason, approved_by, cleared_at, distributor_id, discount_applied)
                VALUES ($1, $2, $3, NOW(), $4, $5)
            `, [batch_id, finalReason, user_id, distributor_id || null, discount_applied || null]);

            // Update batch status
            await client.query(`UPDATE batches SET status = 'cleared' WHERE batch_id = $1`, [batch_id]);
        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid action_type. Must be dispatch or clearance.' });
        }

        // Close out the batch_zone_history
        await client.query(`
            UPDATE batch_zone_history
            SET exit_timestamp = NOW()
            WHERE batch_id = $1 AND exit_timestamp IS NULL
        `, [batch_id]);

        await client.query('COMMIT');

        res.json({ success: true, message: `Batch successfully processed as ${action_type}` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error processing recommendation action:', err);
        res.status(500).json({ error: 'Server error processing action' });
    } finally {
        client.release();
    }
});

// ROUTE 6: GET /alerts/all
// Returns all alerts with specific stats — paginated
router.get('/alerts/all', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;

        // Summary counts (always computed over full dataset)
        const summaryQuery = `
            SELECT
                COUNT(*) as total_alerts,
                COUNT(*) FILTER (WHERE is_read = false) as unread_count,
                COUNT(*) FILTER (WHERE risk_band = 'high') as high_risk_count,
                COUNT(*) FILTER (WHERE risk_band = 'medium') as medium_risk_count,
                COUNT(*) FILTER (WHERE alert_type = 'zone_c_breach') as zone_c_count,
                COUNT(*) FILTER (WHERE alert_type = 'expiry_proximity') as expiry_count
            FROM alert_records
        `;
        const summaryRes = await pool.query(summaryQuery);
        const summary = summaryRes.rows[0];
        const total = parseInt(summary.total_alerts);

        const query = `
            SELECT 
                a.alert_id,
                a.batch_id,
                a.alert_type,
                a.risk_band,
                a.message,
                a.is_read,
                a.created_at,
                p.product_name,
                p.pack_size,
                b.zone_id,
                b.expiry_date,
                b.status,
                fs.frs_score
            FROM alert_records a
            JOIN batches b ON a.batch_id = b.batch_id
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            ORDER BY a.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        res.json({
            alerts: result.rows,
            summary: {
                total_alerts: parseInt(summary.total_alerts),
                unread_count: parseInt(summary.unread_count),
                high_risk_count: parseInt(summary.high_risk_count),
                medium_risk_count: parseInt(summary.medium_risk_count),
                zone_c_count: parseInt(summary.zone_c_count),
                expiry_count: parseInt(summary.expiry_count)
            },
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching all alerts:', err);
        res.status(500).json({ error: 'Server error fetching all alerts' });
    }
});

// ROUTE 7: PATCH /alerts/:alert_id/read
// Updates alert is_read = true
router.patch('/alerts/:alert_id/read', async (req, res) => {
    try {
        const { alert_id } = req.params;
        const query = `
            UPDATE alert_records 
            SET is_read = true 
            WHERE alert_id = $1
            RETURNING *
        `;
        const result = await pool.query(query, [alert_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error marking alert as read:', err);
        res.status(500).json({ error: 'Server error marking alert as read' });
    }
});

// ROUTE 8: GET /batches/:batch_id
// Returns detailed info for a single batch including history
router.get('/batches/:batch_id', async (req, res) => {
    console.log(`[Backend] Received request for batch detail: ${req.params.batch_id}`);
    try {
        const { batch_id } = req.params;

        // 1. Get Batch & Product & Score summary
        const batchQuery = `
            SELECT 
                b.batch_id, b.zone_id, b.quantity, b.manufacturing_date, b.expiry_date, 
                b.arrival_timestamp, b.status,
                p.product_name, p.pack_size, p.shelf_life_months,
                p.max_safe_temp, p.max_safe_humidity,
                p.temp_sensitivity_label, p.humidity_sensitivity_label,
                p.temp_sensitivity_weight, p.humidity_sensitivity_weight,
                fs.frs_score, fs.risk_band, fs.days_in_warehouse, fs.slr_percent_raw,
                fs.total_temp_breach_windows, fs.total_humidity_breach_windows,
                fs.last_calculated_at
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.batch_id = $1
        `;
        const batchRes = await pool.query(batchQuery, [batch_id]);

        if (batchRes.rows.length === 0) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        const batch = batchRes.rows[0];

        // 2. Get Historical Environmental Logs for this zone since batch arrival
        const logsQuery = `
            SELECT log_id, temperature, humidity, logged_at
            FROM environmental_logs
            WHERE zone_id = $1 AND logged_at >= $2
            ORDER BY logged_at DESC
            LIMIT 1000 -- Increased from 50 to show more comprehensive history
        `;
        const logsRes = await pool.query(logsQuery, [batch.zone_id, batch.arrival_timestamp]);

        res.json({
            batch,
            logs: logsRes.rows
        });
    } catch (err) {
        console.error('Error fetching batch details:', err);
        res.status(500).json({ error: 'Server error fetching batch details' });
    }
});

// ROUTE 9: GET /dispatches
// Returns all dispatch records mapped to product and distributor
router.get('/dispatches', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;

        const countRes = await pool.query(`SELECT COUNT(*) FROM dispatch_records`);
        const total = parseInt(countRes.rows[0].count);

        const query = `
            SELECT 
                dr.dispatch_id, dr.batch_id, dr.distributor_id, 
                dr.frs_at_dispatch, dr.risk_band_at_dispatch, dr.zone_at_dispatch,
                dr.dispatch_timestamp, dr.collected_timestamp,
                b.quantity, b.expiry_date,
                p.product_name, p.pack_size,
                d.distributor_name,
                u.full_name as approved_by_name
            FROM dispatch_records dr
            JOIN batches b ON dr.batch_id = b.batch_id
            JOIN products p ON b.product_id = p.product_id
            JOIN distributor_records d ON dr.distributor_id = d.distributor_id
            JOIN users u ON dr.approved_by = u.user_id
            ORDER BY dr.dispatch_timestamp DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);
        res.json({
            dispatches: result.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching dispatch records:', err);
        res.status(500).json({ error: 'Server error fetching dispatch records' });
    }
});

// ROUTE 9.5: GET /clearance-ledger
// Returns historical ledger of all clearance actions — paginated
router.get('/clearance-ledger', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;

        const countRes = await pool.query(`SELECT COUNT(*) FROM clearance_records`);
        const total = parseInt(countRes.rows[0].count);

        const query = `
            SELECT 
                cr.clearance_id, cr.batch_id, cr.reason, cr.cleared_at,
                cr.discount_applied, cr.collected_timestamp,
                p.product_name, p.pack_size,
                b.quantity, b.expiry_date, b.zone_id as zone,
                fs.frs_score, fs.risk_band,
                d.distributor_name,
                u.full_name as approved_by_name
            FROM clearance_records cr
            JOIN batches b ON cr.batch_id = b.batch_id
            JOIN products p ON b.product_id = p.product_id
            LEFT JOIN freshness_scores fs ON cr.batch_id = fs.batch_id
            LEFT JOIN distributor_records d ON cr.distributor_id = d.distributor_id
            JOIN users u ON cr.approved_by = u.user_id
            ORDER BY cr.cleared_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);
        res.json({
            clearances: result.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching clearance ledger:', err);
        res.status(500).json({ error: 'Server error fetching clearance ledger' });
    }
});

// RBAC: Staff can verify physical handover, managers and admin too
router.patch('/clearance/:id/collect', requireRole('admin', 'manager', 'staff'), async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            UPDATE clearance_records 
            SET collected_timestamp = NOW() 
            WHERE clearance_id = $1 AND collected_timestamp IS NULL
            RETURNING *
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Record not found or already verified' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error verifying clearance pickup:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ROUTE 10: PATCH /dispatches/:dispatch_id/collect
// Updates the collected_timestamp for a given dispatch record
// RBAC: Staff can verify physical handover, managers and admin too
router.patch('/dispatches/:dispatch_id/collect', requireRole('admin', 'manager', 'staff'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { dispatch_id } = req.params;

        await client.query('BEGIN');

        // Prevent marking if already collected
        const checkQuery = `SELECT collected_timestamp, distributor_id FROM dispatch_records WHERE dispatch_id = $1`;
        const checkRes = await client.query(checkQuery, [dispatch_id]);

        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Dispatch record not found' });
        }

        if (checkRes.rows[0].collected_timestamp !== null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Batch is already collected.' });
        }

        const distributor_id = checkRes.rows[0].distributor_id;

        const query = `
            UPDATE dispatch_records 
            SET collected_timestamp = NOW() 
            WHERE dispatch_id = $1
            RETURNING *
        `;
        const result = await client.query(query, [dispatch_id]);

        // Update the next visit date based on visit frequency
        await client.query(`
            UPDATE distributor_records
            SET next_visit_date = CURRENT_DATE + visit_frequency_days::integer
            WHERE distributor_id = $1
        `, [distributor_id]);

        await client.query('COMMIT');

        res.json({ success: true, dispatch: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error marking dispatch as collected:', err);
        res.status(500).json({ error: 'Server error marking dispatch collected' });
    } finally {
        client.release();
    }
});
// ROUTE: POST /returns/evaluate
// Evaluates return liability WITHOUT committing to DB
// RBAC: Only admin and manager can evaluate returns
router.post('/returns/evaluate', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { batch_id } = req.body;

        if (!batch_id) {
            return res.status(400).json({ error: 'Missing batch_id' });
        }

        // 1. Validate batch exists and has status = 'dispatched'
        const batchQuery = `SELECT status FROM batches WHERE batch_id = $1 LIMIT 1`;
        const batchRes = await pool.query(batchQuery, [batch_id]);

        if (batchRes.rows.length === 0) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (batchRes.rows[0].status !== 'dispatched') {
            return res.status(400).json({ error: 'Batch is not currently dispatched' });
        }

        // 2. Fetch the most recent dispatch_record for this batch
        const dispatchQuery = `
            SELECT frs_at_dispatch, dispatch_timestamp, distributor_id,
                   EXTRACT(EPOCH FROM (NOW() - dispatch_timestamp)) / 86400 AS days_since_dispatch
            FROM dispatch_records
            WHERE batch_id = $1
            ORDER BY dispatch_timestamp DESC
            LIMIT 1
        `;
        const dispatchRes = await pool.query(dispatchQuery, [batch_id]);

        if (dispatchRes.rows.length === 0) {
            return res.status(400).json({ error: 'No dispatch record found for this batch' });
        }

        const { frs_at_dispatch, dispatch_timestamp, distributor_id, days_since_dispatch: dbDays } = dispatchRes.rows[0];

        // 3. Calculate days_since_dispatch via DB to avoid timezone issues
        const days_since_dispatch = Math.floor(dbDays);

        // 4. Determine recommendation logic
        let recommendation = 'review';
        let reason = 'Mixed signals — physical inspection required before decision';

        if (frs_at_dispatch >= 80 && days_since_dispatch <= 30) {
            recommendation = 'reject';
            reason = 'Batch was in good condition at dispatch and returned within expected window — distributor liable';
        } else if (frs_at_dispatch < 60 || days_since_dispatch > 60) {
            recommendation = 'accept';
            reason = 'Batch had compromised freshness at dispatch or held too long — Nestlé liability';
        }

        res.json({
            recommendation,
            reason,
            frs_at_dispatch,
            days_since_dispatch,
            distributor_id
        });

    } catch (err) {
        console.error('Error evaluating return:', err);
        res.status(500).json({ error: 'Server error processing return evaluation' });
    }
});

// ROUTE 11: POST /returns
// Processes a batch return evaluating liability and creating necessary records
// RBAC: Only admin and manager can process returns
router.post('/returns', requireRole('admin', 'manager'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { batch_id, return_reason, distributor_id, manager_decision, system_recommendation, override_reason, frs_at_dispatch } = req.body;
        const user_id = req.user?.user_id || req.user?.id;
        if (!user_id) return res.status(401).json({ error: 'Unauthorized' });

        // Audit log
        console.log(`[AUDIT] User ${req.user.email} (${req.user.role}) processing return for batch ${batch_id}, decision: ${manager_decision}`);

        if (!batch_id || !distributor_id || !manager_decision || !system_recommendation) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (manager_decision !== system_recommendation && (!override_reason || override_reason.trim() === '')) {
            return res.status(400).json({ error: 'Override reason is mandatory when manager decision differs from system recommendation.' });
        }

        await client.query('BEGIN');

        // 1. Validate batch exists and has status = 'dispatched'
        const batchQuery = `SELECT status FROM batches WHERE batch_id = $1 LIMIT 1`;
        const batchRes = await client.query(batchQuery, [batch_id]);

        if (batchRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (batchRes.rows[0].status !== 'dispatched') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Batch is not currently dispatched' });
        }

        // 2. Insert into return_records
        const insertQuery = `
            INSERT INTO return_records (batch_id, distributor_id, return_reason, frs_at_dispatch, system_recommendation, decision, override_reason, decided_by, decided_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *
        `;
        const returnRecordRes = await client.query(insertQuery, [
            batch_id, distributor_id, return_reason || '', frs_at_dispatch, system_recommendation, manager_decision, override_reason || null, user_id
        ]);
        const returnRecord = returnRecordRes.rows[0];

        // 3. Update batch status to 'returned'
        await client.query(`UPDATE batches SET status = 'returned' WHERE batch_id = $1`, [batch_id]);

        await client.query('COMMIT');

        // Return inserted record
        res.json({
            ...returnRecord,
            success: true
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error processing return:', err);
        res.status(500).json({ error: 'Server error processing return' });
    } finally {
        client.release();
    }
});

// ROUTE 11.5: PATCH /returns/:id/resolve
// Resolves a pending 'review' return to either 'accept' or 'reject'
// RBAC: Only admin and manager can resolve returns
router.patch('/returns/:id/resolve', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { manager_decision, override_reason } = req.body;
        const return_id = req.params.id;
        const user_id = req.user?.user_id || req.user?.id;
        if (!user_id) return res.status(401).json({ error: 'Unauthorized' });

        if (!manager_decision || !['accept', 'reject'].includes(manager_decision)) {
            return res.status(400).json({ error: 'Valid manager decision is required' });
        }

        const currentRecQuery = `SELECT system_recommendation FROM return_records WHERE return_id = $1`;
        const currentRecRes = await pool.query(currentRecQuery, [return_id]);

        if (currentRecRes.rows.length === 0) {
            return res.status(404).json({ error: 'Return record not found' });
        }
        
        const system_recommendation = currentRecRes.rows[0].system_recommendation;

        if (manager_decision !== system_recommendation && (!override_reason || override_reason.trim() === '')) {
            return res.status(400).json({ error: 'Override reason is mandatory when manager decision differs from system recommendation.' });
        }

        const updateQuery = `
            UPDATE return_records
            SET decision = $1, override_reason = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE override_reason END, decided_by = $3, decided_at = NOW()
            WHERE return_id = $4 AND decision = 'review'
            RETURNING *
        `;
        const updateRes = await pool.query(updateQuery, [manager_decision, override_reason || null, user_id, return_id]);

        if (updateRes.rows.length === 0) {
            return res.status(400).json({ error: 'Failed to update return record. It may not be in review state.' });
        }

        res.json(updateRes.rows[0]);
    } catch (err) {
        console.error('Error resolving return:', err);
        res.status(500).json({ error: 'Server error resolving return' });
    }
});

// ROUTE 12: GET /returns
// Returns all return records joined with batch, product, and distributor info — paginated
// RBAC: Only admin and manager can view return history
router.get('/returns', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;

        const countRes = await pool.query(`SELECT COUNT(*) FROM return_records`);
        const total = parseInt(countRes.rows[0].count);

        const query = `
            SELECT 
                rr.return_id,
                rr.batch_id,
                p.product_name,
                d.distributor_name,
                rr.return_reason,
                rr.frs_at_dispatch,
                rr.decision,
                rr.system_recommendation,
                rr.override_reason,
                COALESCE(rr.decided_at, rr.created_at) AS decided_at,
                (EXTRACT(EPOCH FROM (COALESCE(rr.decided_at, rr.created_at) - dr.dispatch_timestamp)) / 86400)::int as days_since_dispatch
            FROM return_records rr
            JOIN batches b ON rr.batch_id = b.batch_id
            JOIN products p ON b.product_id = p.product_id
            JOIN distributor_records d ON rr.distributor_id = d.distributor_id
            LEFT JOIN LATERAL (
                SELECT dispatch_timestamp 
                FROM dispatch_records 
                WHERE batch_id = rr.batch_id AND dispatch_timestamp < COALESCE(rr.decided_at, rr.created_at)
                ORDER BY dispatch_timestamp DESC 
                LIMIT 1
            ) dr ON true
            ORDER BY COALESCE(rr.decided_at, rr.created_at) DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        const records = result.rows.map(record => {
            let decision_reason = 'Mixed signals — physical inspection required before decision';

            if (record.frs_at_dispatch >= 80 && record.days_since_dispatch <= 30) {
                decision_reason = 'Batch was in good condition at dispatch and returned within expected window — distributor liable';
            } else if (record.frs_at_dispatch < 60 || record.days_since_dispatch > 60) {
                decision_reason = 'Batch had compromised freshness at dispatch or held too long — Nestlé liability';
            }

            return {
                ...record,
                decision_reason
            };
        });

        res.json({
            records,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching returns:', err);
        res.status(500).json({ error: 'Server error fetching returns' });
    }
});

// ROUTE 13: GET /clearance-recommendations
// Returns all high-risk in_storage batches with calculated promotions
// RBAC: Only admin and manager can view clearance recommendations
router.get('/clearance-recommendations', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const query = `
            SELECT 
                b.*,
                p.product_name,
                p.pack_size,
                fs.frs_score,
                fs.risk_band,
                fs.days_in_warehouse
            FROM batches b
            JOIN products p ON b.product_id = p.product_id
            JOIN freshness_scores fs ON b.batch_id = fs.batch_id
            WHERE b.status = 'in_storage' AND fs.risk_band = 'high'
            ORDER BY fs.frs_score ASC
        `;
        const result = await pool.query(query);
        const batches = result.rows;

        const results = batches.map(batch => {
            const frs = Number(batch.frs_score);
            let discount_percent = 0;

            if (frs === 0) {
                discount_percent = 35;
            } else if (frs < 20) {
                discount_percent = 30;
            } else if (frs <= 39) {
                discount_percent = 20;
            } else if (frs <= 59) {
                discount_percent = 10;
            }

            let promotion_type = '';
            if (frs >= 40) {
                promotion_type = 'Trade Discount';
            } else if (frs >= 20) {
                promotion_type = 'Clearance Markdown';
            } else {
                promotion_type = 'Fast Distributor Override';
            }

            const parsedDate = new Date(batch.expiry_date);
            const formattedExpiry = !isNaN(parsedDate.getTime())
                ? parsedDate.toISOString().split('T')[0]
                : batch.expiry_date;

            const rationale = `${batch.product_name} has FRS ${batch.frs_score} after ${batch.days_in_warehouse || 0} days in Zone ${batch.zone_id}. Recommend ${promotion_type} at ${discount_percent}% to move stock before expiry on ${formattedExpiry}.`;

            return {
                ...batch,
                discount_percent,
                promotion_type,
                rationale
            };
        });

        res.json(results);

    } catch (err) {
        console.error('Error fetching clearance recommendations:', err);
        res.status(500).json({ error: 'Server error fetching clearance recommendations' });
    }
});

module.exports = router;
