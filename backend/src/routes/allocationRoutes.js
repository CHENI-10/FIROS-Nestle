const express = require('express');
const router = express.Router();
const { getAllocationForBatch, getBatchQueue, confirmAllocation } = require('../controllers/allocationController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(verifyToken);
router.use(requireRole('admin', 'manager', 'warehouse_manager'));

// IMPORTANT: /batch-queue must come BEFORE /:batchId to avoid route conflict
router.get('/batch-queue', getBatchQueue);
router.get('/:batchId', getAllocationForBatch);
router.patch('/:batchId/confirm', confirmAllocation);

module.exports = router;
