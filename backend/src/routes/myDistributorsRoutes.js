/**
 * myDistributorsRoutes.js
 * 
 * Defines the endpoint for Manager's Distributor Relationship Intelligence.
 */

const express = require('express');
const router = express.Router();
const myDistributorsController = require('../controllers/myDistributorsController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// GET /api/my-distributors
// Restricted to warehouse_manager and admin
router.get('/', verifyToken, requireRole('manager', 'admin'), myDistributorsController.getMyDistributors);

module.exports = router;
