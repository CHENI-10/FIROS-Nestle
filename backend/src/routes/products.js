const express = require('express');
const router = express.Router();
const { getProducts } = require('../controllers/productController');
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', verifyToken, requireRole('sales_rep'), getProducts);

module.exports = router;
