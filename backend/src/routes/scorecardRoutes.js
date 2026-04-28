const express = require('express');
const router = express.Router();
const { getAllScorecards, getScorecardDetail } = require('../controllers/scorecardController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(verifyToken);
// Include manager and admin in case the user tries testing with those roles 
// instead of purely warehouse_manager, to match previous changes.
router.use(requireRole('admin', 'manager', 'warehouse_manager'));

router.get('/', getAllScorecards);
router.get('/:distributorId', getScorecardDetail);

module.exports = router;
