-- Add card_reference column to sales_orders (covers POS retail + wholesale)
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS card_reference VARCHAR(100);

-- Add card_reference column to purchase_orders (covers vendor payments)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS card_reference VARCHAR(100);
