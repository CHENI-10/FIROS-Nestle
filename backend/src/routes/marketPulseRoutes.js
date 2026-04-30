const express = require('express');
const router = express.Router();
const marketPulseController = require('../controllers/marketPulseController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Market Pulse relies on field observations, intended for warehouse managers & admins
router.use(verifyToken);
router.use(requireRole('admin', 'manager', 'warehouse_manager'));

router.get('/', marketPulseController.getMarketPulse);

module.exports = router;
