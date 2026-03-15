const express = require('express');
const router = express.Router();

const { recalculateBatchFRS, recalculateAllBatches } = require('../services/frsService');
const pool = require('../config/db');

const verifyToken = require('../middleware/authMiddleware');
const {
    registerBatch,
    getAllBatches,
    updateBatchZone,
    getProductByBarcode
} = require('../controllers/batchController');

// Public route - No auth required
router.get('/products/barcode/:ean13', getProductByBarcode);

router.post('/', verifyToken, registerBatch);
router.get('/', verifyToken, getAllBatches);
router.patch('/:batch_id/zone', verifyToken, updateBatchZone);

// FRS Routes
router.get('/frs', verifyToken, async (req, res) => {
    try {
        const scores = await recalculateAllBatches(pool);
        res.json(scores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/frs/:batch_id', verifyToken, async (req, res) => {
    try {
        const score = await recalculateBatchFRS(pool, req.params.batch_id);
        res.json(score);
    } catch (error) {
        if (error.message === 'Batch not found') {
            return res.status(404).json({ error: 'Batch not found' });
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
