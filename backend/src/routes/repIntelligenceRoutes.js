const express = require('express');
const router = express.Router();
const { getRepIntelligence } = require('../controllers/repIntelligenceController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// GET /api/rep-intelligence?region=Colombo&repWorkId=REP001
// Shared sales_rep JWT — no roleGuard needed beyond verifyToken
router.get('/', verifyToken, requireRole('sales_rep'), getRepIntelligence);

module.exports = router;
