const db = require('../config/db');

const getDistributors = async (req, res) => {
    try {
        const query = 'SELECT distributor_id, distributor_name, region FROM distributor_records';
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching distributors:', error);
        res.status(500).json({ message: 'Server error while fetching distributors' });
    }
};

module.exports = {
    getDistributors
};
