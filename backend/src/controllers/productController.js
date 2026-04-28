const db = require('../config/db');

const getProducts = async (req, res) => {
    try {
        const query = 'SELECT product_id, ean13_barcode, product_name, zone_id FROM products';
        const { rows } = await db.query(query);

        const products = rows.map(row => ({
            sku: row.ean13_barcode || row.product_id.toString(),
            productName: row.product_name,
            category: row.zone_id ? `Zone ${row.zone_id}` : 'General',
            imageUrl: null // No image URL in DB
        }));

        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error while fetching products' });
    }
};

module.exports = {
    getProducts
};
