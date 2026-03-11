const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const {
    registerBatch,
    getAllBatches,
    updateBatchZone
} = require('../controllers/batchController');

router.post('/', verifyToken, registerBatch);
router.get('/', verifyToken, getAllBatches);
router.patch('/:batch_id/zone', verifyToken, updateBatchZone);

module.exports = router;
