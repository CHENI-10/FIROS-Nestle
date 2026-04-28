const express = require('express');
const router = express.Router();
const { getDistributors } = require('../controllers/distributorController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', verifyToken, requireRole('sales_rep'), getDistributors);

module.exports = router;
