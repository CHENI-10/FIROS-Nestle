const express = require('express');
const router = express.Router();
const { submitReport, getReport } = require('../controllers/reportController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.post('/', verifyToken, requireRole('sales_rep'), submitReport);
router.get('/:reportId', verifyToken, requireRole('sales_rep'), getReport);

module.exports = router;
