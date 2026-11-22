-- Migration: columns added after initial schema deploy
-- Run: wrangler d1 execute sana-fresh-erp-db --file=scripts/migrate-001.sql

-- purchase_orders: amount_paid + card_reference
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS amount_paid REAL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS card_reference TEXT;

-- sales_orders: card_reference + split_payments
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS card_reference TEXT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS split_payments TEXT;

-- products: image_url (already in schema but may be missing on older deploys)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS retail_margin_percent REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_margin_percent REAL DEFAULT 0;
