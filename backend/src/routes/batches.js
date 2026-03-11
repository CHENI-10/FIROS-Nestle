const express = require('express');
const router = express.Router();

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

module.exports = router;
