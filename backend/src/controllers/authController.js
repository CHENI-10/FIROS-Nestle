const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const handleAuth = async (req, res, requireRole = null) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const query = 'SELECT user_id, full_name, email, password_hash, role FROM users WHERE email = $1';
        const { rows } = await db.query(query, [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = rows[0];

        if (requireRole && user.role !== requireRole) {
            return res.status(403).json({ message: 'Access forbidden: Incorrect role' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = {
            userId: user.user_id, // new spec
            id: user.user_id, // new spec
            user_id: user.user_id, // backwards compatibility
            fullName: user.full_name, // new spec
            full_name: user.full_name, // backwards compatibility
            email: user.email,
            role: user.role
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        res.json({ token, user: payload });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

const login = (req, res) => handleAuth(req, res);
const salesRepLogin = (req, res) => handleAuth(req, res, 'sales_rep');

const getRepByWorkId = async (req, res) => {
    try {
        const { workId } = req.params;
        const query = 'SELECT rep_id, work_id, name, region FROM sales_reps WHERE work_id = $1';
        const { rows } = await db.query(query, [workId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Rep not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching rep:', error);
        res.status(500).json({ message: 'Server error fetching rep' });
    }
};

const verifyRep = async (req, res) => {
    try {
        const { workId, name } = req.body;
        if (!workId || !name) {
            return res.status(400).json({ success: false, message: 'Work ID and Name are required' });
        }
        
        const query = 'SELECT * FROM sales_reps WHERE work_id = $1 AND LOWER(name) = LOWER($2)';
        const { rows } = await db.query(query, [workId, name]);
        
        if (rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Invalid Work ID or name. Please check your ID card.' });
        }
        
        res.json({
            success: true,
            rep: {
                repId: rows[0].rep_id,
                repWorkId: rows[0].work_id,
                repName: rows[0].name,
                region: rows[0].region
            }
        });
    } catch (error) {
        console.error('Error verifying rep:', error);
        res.status(500).json({ success: false, message: 'Server error verifying rep' });
    }
};

module.exports = {
    login,
    salesRepLogin,
    getRepByWorkId,
    verifyRep
};
