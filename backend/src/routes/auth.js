const express = require('express');
const router = express.Router();

const { login, salesRepLogin } = require('../controllers/authController');

router.post('/login', login);
router.post('/salesrep-login', salesRepLogin);

module.exports = router;
