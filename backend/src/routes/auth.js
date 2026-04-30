const express = require('express');
const router = express.Router();

const { login, salesRepLogin, getRepByWorkId, verifyRep } = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/salesrep-login', salesRepLogin);

router.get('/rep/:workId', verifyToken, getRepByWorkId);
router.post('/verify-rep', verifyToken, verifyRep);

module.exports = router;
