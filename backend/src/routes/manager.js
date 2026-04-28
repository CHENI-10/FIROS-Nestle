const express = require('express');
const router = express.Router();
const { getReports, getReportById, reviewReport } = require('../controllers/managerController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Protect all manager routes
router.use(verifyToken);
router.use(requireRole('admin', 'manager', 'warehouse_manager'));

router.get('/reports', getReports);
router.get('/reports/:reportId', getReportById);
router.patch('/reports/:reportId/review', reviewReport);

module.exports = router;
