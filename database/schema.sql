-- ============================================================
-- FIROS — Complete Database Setup
-- Freshness Intelligence & Risk Optimization System
-- ============================================================
-- WHAT THIS FILE DOES:
--   Creates ALL 15 tables + seeds Sprint 1 data:
--     warehouse_zones      →  4 rows
--     products             → 27 Nestlé Lanka SKUs
--     users                →  4 demo accounts
--     batches              → 12 backdated demo batches
--     freshness_scores     → 12 pre-calculated FRS values
--     batch_zone_history   → 12 zone history entries
--     environmental_logs   →  8 sample readings
--     alert_records        →  6 pre-fired demo alerts
--
-- SPRINT 2 → uncomment INSERT block under distributor_records
-- SPRINT 3 → uncomment INSERT block under distributor_scorecards
-- ============================================================


-- ============================================================
-- SAFETY — clean re-run during development
-- WARNING: deletes ALL data. Comment out before going live.
-- ============================================================
DROP TABLE IF EXISTS report_line_items         CASCADE;
DROP TABLE IF EXISTS sales_rep_reports        CASCADE;
DROP TABLE IF EXISTS distributor_scorecards   CASCADE;
DROP TABLE IF EXISTS return_records           CASCADE;
DROP TABLE IF EXISTS clearance_records        CASCADE;
DROP TABLE IF EXISTS dispatch_records         CASCADE;
DROP TABLE IF EXISTS distributor_records      CASCADE;
DROP TABLE IF EXISTS alert_records            CASCADE;
DROP TABLE IF EXISTS freshness_scores         CASCADE;
DROP TABLE IF EXISTS environmental_logs       CASCADE;
DROP TABLE IF EXISTS batch_zone_history       CASCADE;
DROP TABLE IF EXISTS batches                  CASCADE;
DROP TABLE IF EXISTS products                 CASCADE;
DROP TABLE IF EXISTS warehouse_zones          CASCADE;
DROP TABLE IF EXISTS users                    CASCADE;


-- ============================================================
-- ============================================================
-- SECTION 1 — ALL 15 TABLES
-- ============================================================
-- ============================================================


-- ============================================================
-- TABLE 1: users
-- Introduced: Prerequisites | Seeded: Sprint 1
-- Roles: admin, manager, staff, sales_rep
-- ============================================================
CREATE TABLE users (
    user_id        SERIAL        PRIMARY KEY,
    full_name      VARCHAR(100)  NOT NULL,
    email          VARCHAR(100)  UNIQUE NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    role           VARCHAR(20)   NOT NULL
                   CHECK (role IN ('staff', 'manager', 'sales_rep', 'admin')),
    created_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE 2: warehouse_zones
-- 4 zones: A=Beverages/Noodles, B=Dairy, C=Infant, D=Cold
-- last_reading_at updated by simulator every 30 min
-- Dashboard shows staleness warning per zone if > 60 min old
-- Introduced: Prerequisites | Seeded: Sprint 1
-- ============================================================
CREATE TABLE warehouse_zones (
    zone_id          CHAR(1)       PRIMARY KEY,
    zone_name        VARCHAR(80)   NOT NULL,
    target_temp_min  NUMERIC(4,1)  NOT NULL,
    target_temp_max  NUMERIC(4,1)  NOT NULL,
    humidity_min     NUMERIC(4,1),                      -- NULL for Zone D
    humidity_max     NUMERIC(4,1),                      -- NULL for Zone D
    last_reading_at  TIMESTAMP
);


-- ============================================================
-- TABLE 3: products
-- 27 SKUs. Barcode scan looks up ean13_barcode here.
-- shelf_life_months fixed per SKU. SA = MAX(temp_w, hum_w).
-- Zone D: humidity_weight=0, SA=temp_weight only.
-- Introduced: Prerequisites | Seeded: Sprint 1
-- ============================================================
CREATE TABLE products (
    product_id                  SERIAL        PRIMARY KEY,
    product_name                VARCHAR(150)  NOT NULL,
    pack_size                   VARCHAR(30)   NOT NULL,
    shelf_life_months           INTEGER       NOT NULL CHECK (shelf_life_months > 0),
    temp_sensitivity_label      VARCHAR(10)   NOT NULL
                                CHECK (temp_sensitivity_label IN ('low', 'medium', 'high')),
    humidity_sensitivity_label  VARCHAR(10)   NOT NULL
                                CHECK (humidity_sensitivity_label IN ('low', 'medium', 'high', 'none')),
    temp_sensitivity_weight     INTEGER       NOT NULL
                                CHECK (temp_sensitivity_weight IN (-1, -2, -3)),
    humidity_sensitivity_weight INTEGER       NOT NULL
                                CHECK (humidity_sensitivity_weight IN (-3, -2, -1, 0)),
    max_safe_temp               NUMERIC(4,1)  NOT NULL,
    max_safe_humidity           NUMERIC(4,1),
    zone_id                     CHAR(1)       NOT NULL REFERENCES warehouse_zones(zone_id),
    ean13_barcode               VARCHAR(13)   UNIQUE NOT NULL
);


-- ============================================================
-- TABLE 4: batches
-- batch_id PRIMARY KEY enforces UNIQUE — duplicate scan
-- rejected at DB level, backend returns existing record.
-- FRS engine runs only for status = 'in_storage'.
-- Introduced: Sprint 1 PB-01 | Seeded: Sprint 1 (demo batches)
-- ============================================================
CREATE TABLE batches (
    batch_id           VARCHAR(50)   PRIMARY KEY,
    product_id         INTEGER       NOT NULL REFERENCES products(product_id),
    zone_id            CHAR(1)       NOT NULL REFERENCES warehouse_zones(zone_id),
    quantity           INTEGER       NOT NULL CHECK (quantity > 0),
    manufacturing_date DATE          NOT NULL,
    expiry_date        DATE          NOT NULL,
    arrival_timestamp  TIMESTAMP     NOT NULL DEFAULT NOW(),
    status             VARCHAR(20)   NOT NULL DEFAULT 'in_storage'
                       CHECK (status IN ('in_storage', 'dispatched', 'returned', 'cleared')),
    registered_by      INTEGER       REFERENCES users(user_id),
    created_at         TIMESTAMP     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE 5: batch_zone_history
-- exit_timestamp = NULL means batch is still in this zone.
-- Introduced: Sprint 1 PB-01 | Seeded: Sprint 1
-- ============================================================
CREATE TABLE batch_zone_history (
    history_id       SERIAL        PRIMARY KEY,
    batch_id         VARCHAR(50)   NOT NULL REFERENCES batches(batch_id),
    zone_id          CHAR(1)       NOT NULL REFERENCES warehouse_zones(zone_id),
    entry_timestamp  TIMESTAMP     NOT NULL DEFAULT NOW(),
    exit_timestamp   TIMESTAMP
);


-- ============================================================
-- TABLE 6: environmental_logs
-- Simulator writes here every 30 min. Zone D humidity = NULL.
-- Introduced: Sprint 1 PB-02 | Seeded: Sprint 1 (sample readings)
-- ============================================================
CREATE TABLE environmental_logs (
    log_id       SERIAL        PRIMARY KEY,
    zone_id      CHAR(1)       NOT NULL REFERENCES warehouse_zones(zone_id),
    temperature  NUMERIC(4,1)  NOT NULL,
    humidity     NUMERIC(4,1),
    logged_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_env_logs_zone_time
    ON environmental_logs(zone_id, logged_at DESC);


-- ============================================================
-- TABLE 7: freshness_scores
-- One row per batch. OVERWRITTEN each recalculation.
-- Always calculated from raw totals — never from previous score.
-- FRS = Math.max(0, Math.round(SLR% - SDP - TBP - HBP - SA))
-- SA read fresh from products table, not stored here.
-- Introduced: Sprint 1 PB-03 | Seeded: Sprint 1 (pre-calculated)
-- ============================================================
CREATE TABLE freshness_scores (
    score_id                      SERIAL        PRIMARY KEY,
    batch_id                      VARCHAR(50)   UNIQUE NOT NULL REFERENCES batches(batch_id),
    frs_score                     INTEGER       NOT NULL
                                  CHECK (frs_score >= 0 AND frs_score <= 100),
    risk_band                     VARCHAR(10)   NOT NULL
                                  CHECK (risk_band IN ('low', 'medium', 'high')),
    slr_percent_raw               NUMERIC(6,3)  NOT NULL,
    days_in_warehouse             INTEGER       NOT NULL,
    total_temp_breach_windows     INTEGER       NOT NULL DEFAULT 0,
    total_humidity_breach_windows INTEGER       NOT NULL DEFAULT 0,
    last_calculated_at            TIMESTAMP     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE 8: alert_records
-- Display + deduplication. Same risk_band = SKIP.
-- Zone C exception: zone_c_breach always inserts.
-- Introduced: Sprint 1 PB-06 | Seeded: Sprint 1 (6 demo alerts)
-- ============================================================
CREATE TABLE alert_records (
    alert_id    SERIAL        PRIMARY KEY,
    batch_id    VARCHAR(50)   NOT NULL REFERENCES batches(batch_id),
    alert_type  VARCHAR(25)   NOT NULL
                CHECK (alert_type IN (
                    'medium_risk_crossing',
                    'high_risk_crossing',
                    'expiry_proximity',
                    'zone_c_breach'
                )),
    risk_band   VARCHAR(10)
                CHECK (risk_band IN ('low', 'medium', 'high')),
    message     TEXT          NOT NULL,
    is_read     BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_batch_type
    ON alert_records(batch_id, alert_type, created_at DESC);


-- ============================================================
-- TABLE 9: distributor_records
-- Introduced: Sprint 3 PB-12/PB-13 | Seeded: Sprint 3 (below)
-- ============================================================
CREATE TABLE distributor_records (
    distributor_id    SERIAL        PRIMARY KEY,
    distributor_name  VARCHAR(150)  NOT NULL,
    region            VARCHAR(30)   NOT NULL
                      CHECK (region IN ('Colombo', 'Kandy', 'Galle', 'Jaffna', 'Kurunegala')),
    contact_person    VARCHAR(100),
    phone             VARCHAR(20),
    next_visit_date   DATE,
    visit_frequency_days INTEGER    DEFAULT 30,
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 10: dispatch_records
-- frs_at_dispatch FROZEN at dispatch. collected_timestamp NULL
-- until staff confirms pickup (feeds collection delay calc).
-- Introduced: Sprint 2 PB-08 | Seeded: Runtime Sprint 2
-- ============================================================
CREATE TABLE dispatch_records (
    dispatch_id           SERIAL        PRIMARY KEY,
    batch_id              VARCHAR(50)   NOT NULL REFERENCES batches(batch_id),
    distributor_id        INTEGER       NOT NULL REFERENCES distributor_records(distributor_id),
    frs_at_dispatch       INTEGER       NOT NULL,
    risk_band_at_dispatch VARCHAR(10)   NOT NULL
                          CHECK (risk_band_at_dispatch IN ('low', 'medium', 'high')),
    zone_at_dispatch      CHAR(1)       NOT NULL REFERENCES warehouse_zones(zone_id),
    breaches_summary      TEXT,
    dispatch_timestamp    TIMESTAMP     NOT NULL DEFAULT NOW(),
    collected_timestamp   TIMESTAMP,
    approved_by           INTEGER       NOT NULL REFERENCES users(user_id),
    
    -- Smart Allocation additions
    recommended_distributor_id INTEGER REFERENCES distributor_records(distributor_id),
    allocation_score      NUMERIC,
    allocation_breakdown  JSONB,
    manager_overrode      BOOLEAN       DEFAULT false,
    override_reason       TEXT
);


-- ============================================================
-- TABLE 11: clearance_records
-- Cleared = final status. Both clearance and write-off land here.
-- Introduced: Sprint 2 PB-10 | Seeded: Runtime Sprint 2
-- ============================================================
CREATE TABLE clearance_records (
    clearance_id  SERIAL        PRIMARY KEY,
    batch_id      VARCHAR(50)   NOT NULL REFERENCES batches(batch_id),
    reason        VARCHAR(100)  NOT NULL,
    notes         TEXT,
    distributor_id INTEGER      REFERENCES distributor_records(distributor_id),
    discount_applied NUMERIC(5,2),
    collected_timestamp TIMESTAMP,
    approved_by   INTEGER       NOT NULL REFERENCES users(user_id),
    cleared_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE 12: return_records
-- frs_at_dispatch from certificate = evidence for decision.
-- decision: accept / review / reject
-- Introduced: Sprint 2 PB-09 | Seeded: Runtime Sprint 2
-- ============================================================
CREATE TABLE return_records (
    return_id       SERIAL        PRIMARY KEY,
    batch_id        VARCHAR(50)   NOT NULL REFERENCES batches(batch_id),
    distributor_id  INTEGER       NOT NULL REFERENCES distributor_records(distributor_id),
    return_reason   TEXT          NOT NULL,
    frs_at_dispatch INTEGER       NOT NULL,
    system_recommendation VARCHAR(10) CHECK (system_recommendation IN ('accept', 'review', 'reject')),
    decision        VARCHAR(10)   CHECK (decision IN ('accept', 'review', 'reject')),
    override_reason TEXT,
    decided_by      INTEGER       REFERENCES users(user_id),
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    decided_at      TIMESTAMP
);


-- ============================================================
-- TABLE 13: distributor_scorecards
-- Allocation formula: movement_score + (performance_score / 20)
-- Pre-seeded with historical data before Sprint 3 demo.
-- Introduced: Sprint 3 PB-13 | Seeded: Sprint 3 (below)
-- ============================================================
CREATE TABLE distributor_scorecards (
    scorecard_id               SERIAL        PRIMARY KEY,
    distributor_id             INTEGER       UNIQUE NOT NULL
                               REFERENCES distributor_records(distributor_id),
    performance_score          NUMERIC(5,2)  NOT NULL DEFAULT 50.00,
    total_dispatches           INTEGER       NOT NULL DEFAULT 0,
    total_returns              INTEGER       NOT NULL DEFAULT 0,
    rejected_returns           INTEGER       NOT NULL DEFAULT 0,
    expired_batches            INTEGER       NOT NULL DEFAULT 0,
    avg_collection_delay_days  NUMERIC(5,2)  NOT NULL DEFAULT 0.00,
    avg_frs_at_dispatch        NUMERIC(5,2)  NOT NULL DEFAULT 0.00,
    loss_contribution          NUMERIC(10,2) DEFAULT 0.00,
    last_updated_at            TIMESTAMP     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE 14: sales_rep_reports
-- movement_score: fast=3, medium=2, slow=1
-- urgency_bonus: +1 if out_of_stock
-- Introduced: Sprint 3 PB-11 | Seeded: Runtime Sprint 3
-- ============================================================
CREATE TABLE sales_rep_reports (
    report_id          SERIAL        PRIMARY KEY,
    sales_rep_id       INTEGER       NOT NULL REFERENCES users(user_id),
    region             VARCHAR(30)   NOT NULL
                       CHECK (region IN ('Colombo', 'Kandy', 'Galle', 'Jaffna', 'Kurunegala')),
    product_id         INTEGER       NOT NULL REFERENCES products(product_id),
    retailer_name      VARCHAR(100),
    distributor_name   VARCHAR(100),
    audit_date         DATE,
    movement_speed     VARCHAR(10)   NOT NULL
                       CHECK (movement_speed IN ('fast', 'medium', 'slow')),
    movement_score     INTEGER       NOT NULL
                       CHECK (movement_score IN (1, 2, 3)),
    shelf_availability VARCHAR(15)   NOT NULL
                       CHECK (shelf_availability IN ('in_stock', 'low', 'out_of_stock')),
    urgency_bonus      INTEGER       NOT NULL DEFAULT 0
                       CHECK (urgency_bonus IN (0, 1)),
    notes              TEXT,
    status             VARCHAR(20)   NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'reviewed')),
    reviewed_at        TIMESTAMP,
    reviewed_by        INTEGER       REFERENCES users(user_id),
    submitted_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE 15: report_line_items
-- Detail line items for sales rep reports.
-- Introduced: Sprint 3 PB-11 | Seeded: Runtime Sprint 3
-- ============================================================
CREATE TABLE report_line_items (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES sales_rep_reports(report_id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    movement_speed_raw INTEGER NOT NULL CHECK (movement_speed_raw IN (1,2,3)),
    movement_score_final INTEGER NOT NULL,
    shelf_availability VARCHAR(20) NOT NULL
        CHECK (shelf_availability IN ('in_stock','low','out_of_stock')),
    is_empty_shelf BOOLEAN NOT NULL DEFAULT FALSE,
    urgency_bonus_applied BOOLEAN NOT NULL DEFAULT FALSE
);


-- ============================================================
-- ============================================================
-- SECTION 2 — SPRINT 1 SEED DATA
-- ============================================================
-- ============================================================


-- ============================================================
-- SEED 1: WAREHOUSE ZONES (4 rows)
-- ============================================================
INSERT INTO warehouse_zones
    (zone_id, zone_name, target_temp_min, target_temp_max, humidity_min, humidity_max)
VALUES
    ('A', 'Powdered Beverages, Noodles & Seasonings', 25.0, 28.0, 60.0, 65.0),
    ('B', 'Dairy & Condensed',                        22.0, 26.0, 55.0, 60.0),
    ('C', 'Infant & Nutrition (Strictest Zone)',       20.0, 25.0, 50.0, 55.0),
    ('D', 'Cold Storage',                               2.0,  8.0, NULL, NULL);


-- ============================================================
-- SEED 2: ALL 27 NESTLÉ LANKA SKUs
-- ============================================================
-- Zone A — 17 SKUs
INSERT INTO products
    (product_name, pack_size, shelf_life_months,
     temp_sensitivity_label, humidity_sensitivity_label,
     temp_sensitivity_weight, humidity_sensitivity_weight,
     max_safe_temp, max_safe_humidity, zone_id, ean13_barcode)
VALUES
    ('Milo',                            '400g tin',   18, 'medium', 'high',   -2, -3, 30.0, 70.0, 'A', '4792024021777'),
    ('Milo',                            '200g pouch', 18, 'medium', 'high',   -2, -3, 30.0, 70.0, 'A', '4790361128913'),
    ('Nestomalt',                       '400g tin',   18, 'medium', 'high',   -2, -3, 30.0, 70.0, 'A', '4790361128920'),
    ('Nestomalt',                       '200g pouch', 18, 'medium', 'high',   -2, -3, 30.0, 70.0, 'A', '4790361128937'),
    ('Nescafe Classic',                 '100g jar',   24, 'medium', 'high',   -2, -3, 28.0, 65.0, 'A', '4790361128944'),
    ('Nescafe Classic',                 '50g jar',    24, 'medium', 'high',   -2, -3, 28.0, 65.0, 'A', '4790361128951'),
    ('Nescafe Gold Blend',              '100g jar',   24, 'medium', 'high',   -2, -3, 28.0, 65.0, 'A', '4790361128968'),
    ('Maggi Chicken Noodles',           '73g pack',   12, 'low',    'medium', -1, -2, 35.0, 75.0, 'A', '4792024020190'),
    ('Maggi Curry Noodles',             '77g pack',   12, 'low',    'medium', -1, -2, 35.0, 75.0, 'A', '4790361128982'),
    ('Maggi Devilled Noodles',          '77g pack',   12, 'low',    'medium', -1, -2, 35.0, 75.0, 'A', '4790361128999'),
    ('Maggi Papare Kottu Noodles',      '77g pack',   12, 'low',    'medium', -1, -2, 35.0, 75.0, 'A', '4790361129001'),
    ('Maggi Coconut Milk Powder',       '150g pack',  18, 'low',    'high',   -1, -3, 32.0, 65.0, 'A', '4790361129018'),
    ('Maggi Coconut Milk Powder',       '300g pack',  18, 'low',    'high',   -1, -3, 32.0, 65.0, 'A', '4790361129025'),
    ('Maggi Chicken Seasoning Cubes',   '80g box',    24, 'low',    'medium', -1, -2, 35.0, 75.0, 'A', '4790361129032'),
    ('Maggi Vegetable Seasoning Cubes', '80g box',    24, 'low',    'medium', -1, -2, 35.0, 75.0, 'A', '4790361129049'),
    ('Maggi Seasoning Soup Cubes',      '80g box',    24, 'low',    'medium', -1, -2, 35.0, 75.0, 'A', '4790361129056'),
    ('Maggi Rasamusu Seasoning',        '85g pack',   24, 'low',    'medium', -1, -2, 35.0, 75.0, 'A', '4790361129063');

-- Zone B — 5 SKUs
INSERT INTO products
    (product_name, pack_size, shelf_life_months,
     temp_sensitivity_label, humidity_sensitivity_label,
     temp_sensitivity_weight, humidity_sensitivity_weight,
     max_safe_temp, max_safe_humidity, zone_id, ean13_barcode)
VALUES
    ('Nespray Full Cream Milk Powder',  '400g pack',  24, 'high',   'high',   -3, -3, 27.0, 60.0, 'B', '4790361129070'),
    ('Nespray Full Cream Milk Powder',  '800g pack',  24, 'high',   'high',   -3, -3, 27.0, 60.0, 'B', '4790361129087'),
    ('Nespray Instant Full Cream',      '180g pack',  24, 'high',   'high',   -3, -3, 27.0, 60.0, 'B', '4790361129094'),
    ('Milkmaid Condensed Milk',         '400g can',   24, 'medium', 'low',    -2, -1, 32.0, 80.0, 'B', '4792024011792'),
    ('Milkmaid Condensed Milk',         '200g can',   24, 'medium', 'low',    -2, -1, 32.0, 80.0, 'B', '4790361129117');

-- Zone C — 4 SKUs
INSERT INTO products
    (product_name, pack_size, shelf_life_months,
     temp_sensitivity_label, humidity_sensitivity_label,
     temp_sensitivity_weight, humidity_sensitivity_weight,
     max_safe_temp, max_safe_humidity, zone_id, ean13_barcode)
VALUES
    ('Cerelac Wheat',                    '400g tin',  18, 'high', 'high', -3, -3, 25.0, 55.0, 'C', '4790361129124'),
    ('Cerelac Multi-Grain',              '400g tin',  18, 'high', 'high', -3, -3, 25.0, 55.0, 'C', '4790361129131'),
    ('Nangrow Growing Up Milk 1-3yrs',   '400g tin',  24, 'high', 'high', -3, -3, 25.0, 55.0, 'C', '4790361129148'),
    ('Lactogrow Growing Up Milk 3-5yrs', '400g tin',  24, 'high', 'high', -3, -3, 25.0, 55.0, 'C', '4790361129155');

-- Zone D — 1 SKU
INSERT INTO products
    (product_name, pack_size, shelf_life_months,
     temp_sensitivity_label, humidity_sensitivity_label,
     temp_sensitivity_weight, humidity_sensitivity_weight,
     max_safe_temp, max_safe_humidity, zone_id, ean13_barcode)
VALUES
    ('Nescafe Iced Coffee RTD', '180ml bottle', 6, 'high', 'none', -3, 0, 10.0, NULL, 'D', '4792024014601');


-- ============================================================
-- SEED 3: DEMO USERS (4 accounts)
-- ============================================================
INSERT INTO users (full_name, email, password_hash, role) VALUES
('Admin',             'admin@nestle.lk',   '$2a$12$y8PnbdahHUCQtlmSEwUweewwZZq3DZoZVRaAki5PUdMtXi2dq2pwi', 'admin'),     
('Warehouse Manager', 'manager@nestle.lk', '$2a$12$rMrURR.VipYAT8iCdSekk.bKW0z.P5/xIDcIZTDxonDawvxML/54u', 'manager'),
('Warehouse Staff',   'staff@nestle.lk',   '$2a$12$4Qyk4QW5LCigkmSK5ei2beRk9VfTyN/TG8ZoNK8YQNz.DNu4RWFH.', 'staff'),
('Sales Rep',         'rep@nestle.lk',     '$2a$12$.Nog/05unLF5MIM6KAZ8M.VuOf.xlrEG12rG5CqfstC60nHAGvx52', 'sales_rep');


-- ============================================================
-- SEED 4: DEMO BATCHES
-- ============================================================
INSERT INTO batches (batch_id, product_id, zone_id, quantity,
    manufacturing_date, expiry_date, arrival_timestamp, status, registered_by)
VALUES 
('MILO-400-2026-0031', 1, 'A', 240, '2026-01-15', '2027-07-15', NOW() - INTERVAL '15 days', 'in_storage', 2),
('MILO-400-2026-0032', 1, 'A', 240, '2025-12-01', '2027-06-01', NOW() - INTERVAL '45 days', 'in_storage', 3),
('MAGGI-CUR-2026-0007', 9, 'A', 180, '2025-11-01', '2026-11-01', NOW() - INTERVAL '90 days', 'in_storage', 3),
('NEST-400-2026-0019', 3, 'A', 200, '2026-01-01', '2027-07-01', NOW() - INTERVAL '20 days', 'in_storage', 3),
('MGCP-150-2026-0004', 12, 'A', 120, '2025-11-15', '2027-05-15', NOW() - INTERVAL '55 days', 'in_storage', 3),
('NESP-400-2026-0003', 18, 'B', 150, '2026-02-01', '2028-02-01', NOW() - INTERVAL '30 days', 'in_storage', 3),
('MLKM-400-2026-0008', 21, 'B', 96, '2025-11-01', '2027-11-01', NOW() - INTERVAL '70 days', 'in_storage', 2),
('NESP-800-2026-0001', 19, 'B', 80, '2025-10-01', '2027-10-01', NOW() - INTERVAL '110 days', 'in_storage', 2),
('CERL-WHT-2026-0022', 23, 'C', 144, '2026-02-01', '2027-08-01', NOW() - INTERVAL '10 days', 'in_storage', 3),
('NANG-400-2026-0011', 25, 'C', 72, '2025-12-01', '2027-12-01', NOW() - INTERVAL '50 days', 'in_storage', 3),
('LACT-400-2025-0002', 26, 'C', 60, '2025-01-01', '2027-01-01', NOW() - INTERVAL '280 days', 'in_storage', 2),
('NICD-180-2026-0005', 27, 'D', 432, '2025-11-15', '2026-05-15', NOW() - INTERVAL '20 days', 'in_storage', 3);


-- ============================================================
-- SEED 5: BATCH ZONE HISTORY
-- ============================================================
INSERT INTO batch_zone_history (batch_id, zone_id, entry_timestamp) VALUES
    ('MILO-400-2026-0031',  'A', NOW() - INTERVAL '15 days'),
    ('MILO-400-2026-0032',  'A', NOW() - INTERVAL '45 days'),
    ('MAGGI-CUR-2026-0007', 'A', NOW() - INTERVAL '90 days'),
    ('NEST-400-2026-0019',  'A', NOW() - INTERVAL '20 days'),
    ('MGCP-150-2026-0004',  'A', NOW() - INTERVAL '55 days'),
    ('NESP-400-2026-0003',  'B', NOW() - INTERVAL '30 days'),
    ('MLKM-400-2026-0008',  'B', NOW() - INTERVAL '70 days'),
    ('NESP-800-2026-0001',  'B', NOW() - INTERVAL '110 days'),
    ('CERL-WHT-2026-0022',  'C', NOW() - INTERVAL '10 days'),
    ('NANG-400-2026-0011',  'C', NOW() - INTERVAL '50 days'),
    ('LACT-400-2025-0002',  'C', NOW() - INTERVAL '280 days'),
    ('NICD-180-2026-0005',  'D', NOW() - INTERVAL '20 days');


-- ============================================================
-- SEED 6: FRESHNESS SCORES
-- ============================================================
INSERT INTO freshness_scores
    (batch_id, frs_score, risk_band, slr_percent_raw,
     days_in_warehouse, total_temp_breach_windows,
     total_humidity_breach_windows, last_calculated_at)
VALUES
('MILO-400-2026-0031',  84, 'low',    90.476, 15,  0, 0, NOW()),
('MILO-400-2026-0032',  65, 'medium', 82.267, 45,  0, 1, NOW()),
('MAGGI-CUR-2026-0007', 41, 'high',   65.205, 90,  0, 0, NOW()),
('NEST-400-2026-0019',  80, 'low',    87.912, 20,  0, 0, NOW()),
('MGCP-150-2026-0004',  60, 'medium', 79.304, 55,  0, 1, NOW()),
('NESP-400-2026-0003',  82, 'low',    95.205, 30,  1, 0, NOW()),
('MLKM-400-2026-0008',  63, 'medium', 82.603, 70,  0, 0, NOW()),
('NESP-800-2026-0001',  39, 'high',   78.356, 110, 3, 0, NOW()),
('CERL-WHT-2026-0022',  88, 'low',    93.590, 10,  0, 0, NOW()),
('NANG-400-2026-0011',  68, 'medium', 86.712, 50,  1, 0, NOW()),
('LACT-400-2025-0002',   0, 'high',   40.959, 280, 4, 3, NOW()),
('NICD-180-2026-0005',  27, 'high',   37.569, 20,  1, 0, NOW());


-- ============================================================
-- SEED 7: SAMPLE ENVIRONMENTAL LOGS
-- ============================================================
INSERT INTO environmental_logs (zone_id, temperature, humidity, logged_at)
VALUES
    ('A', 27.2, 64.0, NOW() - INTERVAL '60 minutes'),
    ('A', 27.8, 71.4, NOW() - INTERVAL '30 minutes'),
    ('B', 25.1, 57.0, NOW() - INTERVAL '60 minutes'),
    ('B', 27.6, 58.0, NOW() - INTERVAL '30 minutes'),
    ('C', 23.8, 53.0, NOW() - INTERVAL '60 minutes'),
    ('C', 24.1, 52.5, NOW() - INTERVAL '30 minutes'),
    ('D',  7.4, NULL, NOW() - INTERVAL '60 minutes'),
    ('D',  7.8, NULL, NOW() - INTERVAL '30 minutes');


-- ============================================================
-- SEED 8: PRE-FIRED DEMO ALERTS
-- ============================================================
INSERT INTO alert_records (batch_id, alert_type, risk_band, message, is_read, created_at)
VALUES
    ('MILO-400-2026-0032', 'medium_risk_crossing', 'medium', 'Milo 400g — MILO-400-2026-0032 (Zone A): FRS 65. MEDIUM RISK. Recommend priority dispatch.', FALSE, NOW() - INTERVAL '20 days'),
    ('MAGGI-CUR-2026-0007', 'high_risk_crossing', 'high', 'Maggi Curry Noodles — MAGGI-CUR-2026-0007 (Zone A): FRS 41. HIGH RISK. Removed from queue. Recommend 20% clearance discount.', FALSE, NOW() - INTERVAL '30 days'),
    ('NESP-800-2026-0001', 'high_risk_crossing', 'high', 'Nespray Full Cream 800g — NESP-800-2026-0001 (Zone B): FRS 39. HIGH RISK. 3 temperature breaches. Immediate action required.', FALSE, NOW() - INTERVAL '45 days'),
    ('NANG-400-2026-0011', 'zone_c_breach', 'medium', 'Nangrow Growing Up Milk — NANG-400-2026-0011 (Zone C): Temperature breach 26.1 degrees. Infant product. Immediate review required.', FALSE, NOW() - INTERVAL '25 days'),
    ('LACT-400-2025-0002', 'high_risk_crossing', 'high', 'Lactogrow Growing Up Milk — LACT-400-2025-0002 (Zone C): FRS 0. HIGH RISK. 280 days in warehouse. Urgent clearance required.', FALSE, NOW() - INTERVAL '100 days'),
    ('NICD-180-2026-0005', 'expiry_proximity', 'high', 'Nescafe Iced Coffee RTD — NICD-180-2026-0005 (Zone D): Expiry 2026-05-15. FRS 27. Most urgent SKU in warehouse.', FALSE, NOW() - INTERVAL '5 days');


-- ============================================================
-- SEED 9: MASTER DISTRIBUTORS
-- ============================================================
INSERT INTO distributor_records 
    (distributor_name, region, contact_person, phone, next_visit_date, visit_frequency_days)
VALUES
    ('Keells Food Products',         'Colombo',    'Roshan Fernando',    '0112345678', '2026-04-22', 14),
    ('Central Depot Lanka',          'Kurunegala', 'Nimal Perera',       '0372345678', '2026-05-08', 30),
    ('Lanka Canneries Ltd',          'Kandy',      'Suresh Silva',       '0812345678', '2026-04-29', 21),
    ('Southern Traders',             'Galle',      'Pradeep Rathnayake', '0912345678', '2026-05-05', 30),
    ('Jaffna Distributors Ltd',      'Jaffna',     'Arjun Nadarajah',    '0212345678', '2026-05-12', 30),
    ('Cargills Ceylon PLC',          'Colombo',    'Dinesh Jayawardena', '0117654321', '2026-04-26', 14),
    ('Advantis Logistics',           'Kandy',      'Chaminda Rathnayake','0819876543', '2026-05-13', 21),
    ('Aitken Spence Logistics',      'Colombo',    'Ravi Wijesekara',    '0115432100', '2026-04-15', 7),
    ('Galle Wholesale Traders',      'Galle',      'Sanjeewa Perera',    '0914321098', '2026-04-25', 30),
    ('Kurunegala Agencies Ltd',      'Kurunegala', 'Thilak Bandara',     '0372109876', '2026-05-07', 21);


-- ============================================================
-- SEED 10: DISTRIBUTOR SCORECARDS
-- ============================================================
INSERT INTO distributor_scorecards (
    distributor_id, performance_score, total_dispatches,
    total_returns, rejected_returns, expired_batches,
    avg_collection_delay_days, avg_frs_at_dispatch, loss_contribution)
VALUES
    (1, 87.00, 142,  8,  2, 1,  2.1, 74.5, 500.00),
    (2, 83.00,  98,  7,  2, 1,  3.4, 71.2, 350.00),
    (3, 74.00,  76,  9,  3, 2,  5.8, 68.9, 1200.00),
    (4, 61.00,  54, 14,  8, 4, 11.2, 62.3, 4500.00),
    (5, 69.00,  43,  6,  2, 1,  7.3, 67.1, 800.00);
