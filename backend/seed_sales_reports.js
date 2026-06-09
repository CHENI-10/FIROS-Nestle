const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seed() {
    try {
        console.log("Seeding sales rep demo data...");

        // Insert 1: OOS Report (Triggers Replenishment Reminder)
        const res1 = await pool.query(`
            INSERT INTO sales_rep_reports 
            (sales_rep_id, region, rep_work_id, rep_name, retailer_name, status, submitted_at, product_id, movement_speed, movement_score, shelf_availability) 
            VALUES (1, 'Colombo', 'REP001', 'Amal Silva', 'Keells - Union Place', 'pending', NOW() - INTERVAL '2 hours', 1, 'fast', 1, 'out_of_stock') 
            RETURNING report_id
        `);
        const reportId1 = res1.rows[0].report_id;
        
        await pool.query(`
            INSERT INTO report_line_items 
            (report_id, sku, product_name, category, movement_speed_raw, movement_score_final, shelf_availability, is_empty_shelf)
            VALUES ($1, '4790361128913', 'Milo RTD 180ml', 'Zone A', 3, 3, 'out_of_stock', true)
        `, [reportId1]);

        // Insert 2: Slow Mover Report (Triggers Visibility Check)
        const res2 = await pool.query(`
            INSERT INTO sales_rep_reports 
            (sales_rep_id, region, rep_work_id, rep_name, retailer_name, status, submitted_at, product_id, movement_speed, movement_score, shelf_availability) 
            VALUES (1, 'Colombo', 'REP001', 'Amal Silva', 'Arpico - Hyde Park', 'pending', NOW() - INTERVAL '1 day', 2, 'slow', 3, 'high') 
            RETURNING report_id
        `);
        const reportId2 = res2.rows[0].report_id;
        
        await pool.query(`
            INSERT INTO report_line_items 
            (report_id, sku, product_name, category, movement_speed_raw, movement_score_final, shelf_availability, is_empty_shelf)
            VALUES ($1, '4791234567890', 'Maggi Noodles 78g', 'Zone A', 1, 1.2, 'high', false)
        `, [reportId2]);

        // Insert 3: Optimal Report (Just to show some good data)
        const res3 = await pool.query(`
            INSERT INTO sales_rep_reports 
            (sales_rep_id, region, rep_work_id, rep_name, retailer_name, status, submitted_at, product_id, movement_speed, movement_score, shelf_availability) 
            VALUES (1, 'Colombo', 'REP001', 'Amal Silva', 'Cargills - Bambalapitiya', 'pending', NOW() - INTERVAL '3 days', 3, 'medium', 2, 'in_stock') 
            RETURNING report_id
        `);
        const reportId3 = res3.rows[0].report_id;
        
        await pool.query(`
            INSERT INTO report_line_items 
            (report_id, sku, product_name, category, movement_speed_raw, movement_score_final, shelf_availability, is_empty_shelf)
            VALUES ($1, '4790987654321', 'Nescafe Classic 50g', 'Zone A', 2, 2.5, 'in_stock', false)
        `, [reportId3]);

        // Also add some data for REP002 just in case they log in as someone else
        const res4 = await pool.query(`
            INSERT INTO sales_rep_reports 
            (sales_rep_id, region, rep_work_id, rep_name, retailer_name, status, submitted_at, product_id, movement_speed, movement_score, shelf_availability) 
            VALUES (2, 'Kandy', 'REP002', 'Priya Fernando', 'Spar - Kandy', 'pending', NOW() - INTERVAL '5 hours', 1, 'fast', 1, 'out_of_stock') 
            RETURNING report_id
        `);
        const reportId4 = res4.rows[0].report_id;

        await pool.query(`
            INSERT INTO report_line_items 
            (report_id, sku, product_name, category, movement_speed_raw, movement_score_final, shelf_availability, is_empty_shelf)
            VALUES ($1, '4790361128913', 'Milo RTD 180ml', 'Zone A', 3, 3, 'out_of_stock', true)
        `, [reportId4]);

        console.log("Demo data added successfully!");
    } catch (e) {
        console.error("Error seeding data:", e);
    } finally {
        pool.end();
    }
}
seed();
