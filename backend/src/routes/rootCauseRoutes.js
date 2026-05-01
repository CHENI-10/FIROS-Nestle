const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const rootCauseController = require('../controllers/rootCauseController');

// GET /api/root-cause
// Protected route: only accessible by authenticated 'manager' role
// Query params: ?month=10&year=2025 (optional, defaults to current month)
router.get('/', 
    verifyToken, 
    requireRole('manager'), 
    rootCauseController.getRootCauseAnalytics
);

router.get('/live-impact', 
    verifyToken, 
    requireRole('manager'), 
    rootCauseController.getLiveImpact
);

module.exports = router;
