-- Migration 001: columns added after initial schema deploy
-- SQLite/D1 does not support IF NOT EXISTS on ALTER TABLE
-- These will error silently if column already exists — that is safe in D1 batch mode

ALTER TABLE purchase_orders ADD COLUMN amount_paid REAL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN card_reference TEXT;
ALTER TABLE sales_orders ADD COLUMN card_reference TEXT;
ALTER TABLE sales_orders ADD COLUMN split_payments TEXT;
ALTER TABLE products ADD COLUMN image_url TEXT;
ALTER TABLE products ADD COLUMN retail_margin_percent REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN wholesale_margin_percent REAL DEFAULT 0;
