const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');

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
            WHERE b.status = 'in_storage'
            ORDER BY fs.frs_score ASC
        `;

        const result = await pool.query(query);
        const batches = result.rows;

        let totalFrs = 0;
        let frsCount = 0;
        let high_risk_count = 0;
        let medium_risk_count = 0;
        let low_risk_count = 0;

        batches.forEach(batch => {
            if (batch.frs_score !== null && batch.frs_score !== undefined) {
                totalFrs += Number(batch.frs_score);
                frsCount++;
            }
            if (batch.risk_band === 'high') high_risk_count++;
            if (batch.risk_band === 'medium') medium_risk_count++;
            if (batch.risk_band === 'low') low_risk_count++;
        });

        const overall_freshness_percent = frsCount > 0 ? Math.round(totalFrs / frsCount) : 0;
        const total_batches = batches.length;

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
            SELECT zone_id, zone_name, last_reading_at AT TIME ZONE 'UTC' as last_reading_at
            FROM warehouse_zones
            ORDER BY zone_id
        `;
        const result = await pool.query(query);

        const zones = result.rows.map(zone => {
            let minutes_since_reading = null;
            let is_stale = true;

            if (zone.last_reading_at) {
                const lastReadingDate = new Date(zone.last_reading_at);
                const diffMs = Date.now() - lastReadingDate.getTime();
                minutes_since_reading = Math.floor(diffMs / (1000 * 60));

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
                EXTRACT(DAY FROM (b.expiry_date - CURRENT_DATE)) as days_until_expiry
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
                recommendationObj.recommendation = 'Remove from dispatch queue. Recommend 20% trade discount to fastest distributor or bundle with healthy-FRS product. Manager must approve clearance.';
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
router.post('/recommendations/action', async (req, res) => {
    const client = await pool.connect();
    try {
        const { batch_id, action_type, distributor_id, reason } = req.body;
        const user_id = req.user.user_id || req.user.id || 1; // Using token validation

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
            const finalReason = reason || 'System Promoted Clearance';
            await client.query(`
                INSERT INTO clearance_records (batch_id, reason, approved_by, cleared_at)
                VALUES ($1, $2, $3, NOW())
            `, [batch_id, finalReason, user_id]);

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
// Returns all alerts with specific stats
router.get('/alerts/all', async (req, res) => {
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
        `;
        const result = await pool.query(query);
        const alerts = result.rows;

        // Calculate summary counts
        let total_alerts = alerts.length;
        let unread_count = 0;
        let high_risk_count = 0;
        let medium_risk_count = 0;
        let zone_c_count = 0;
        let expiry_count = 0;

        alerts.forEach(alert => {
            if (alert.is_read === false) unread_count++;
            if (alert.risk_band === 'high') high_risk_count++;
            if (alert.risk_band === 'medium') medium_risk_count++;
            if (alert.alert_type === 'zone_c_breach') zone_c_count++;
            if (alert.alert_type === 'expiry_proximity') expiry_count++;
        });

        res.json({
            alerts,
            summary: {
                total_alerts,
                unread_count,
                high_risk_count,
                medium_risk_count,
                zone_c_count,
                expiry_count
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
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching dispatch records:', err);
        res.status(500).json({ error: 'Server error fetching dispatch records' });
    }
});

// ROUTE 10: PATCH /dispatches/:dispatch_id/collect
// Updates the collected_timestamp for a given dispatch record
router.patch('/dispatches/:dispatch_id/collect', async (req, res) => {
    try {
        const { dispatch_id } = req.params;
        
        // Prevent marking if already collected
        const checkQuery = `SELECT collected_timestamp FROM dispatch_records WHERE dispatch_id = $1`;
        const checkRes = await pool.query(checkQuery, [dispatch_id]);
        
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Dispatch record not found' });
        }
        
        if (checkRes.rows[0].collected_timestamp !== null) {
            return res.status(400).json({ error: 'Batch is already collected.' });
        }

        const query = `
            UPDATE dispatch_records 
            SET collected_timestamp = NOW() 
            WHERE dispatch_id = $1
            RETURNING *
        `;
        const result = await pool.query(query, [dispatch_id]);

        res.json({ success: true, dispatch: result.rows[0] });
    } catch (err) {
        console.error('Error marking dispatch as collected:', err);
        res.status(500).json({ error: 'Server error marking dispatch collected' });
    }
});

module.exports = router;
