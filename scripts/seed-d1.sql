-- SANA FRESH ERP — Cloudflare D1 Initial Seed Data
-- Run: wrangler d1 execute sana-fresh-erp-db --file=scripts/seed-d1.sql

-- 1. Users (Edge WebCrypto PBKDF2 Password Hashes)
-- Default passwords:
-- admin@sanafresh.co.uk           -> admin123
-- sarah.manager@sanafresh.co.uk   -> manager123
-- alex.cashier@sanafresh.co.uk    -> cashier123
-- sales@sanafresh.co.uk           -> sales123
-- elena.stock@sanafresh.co.uk     -> stock123

INSERT OR IGNORE INTO users (id, email, name, password_hash, pin_code, role, phone, status, permissions)
VALUES
  (1, 'admin@sanafresh.co.uk', 'Alexander Vance (Super Admin)', '0102030405060708090a0b0c0d0e0f10:4666e5962c22a221dc89bafcf38102d34ba599ddc25267143b049a320da79433', '1122', 'ADMIN', '02035766816', 'ACTIVE', '["*"]'),
  (2, 'sarah.manager@sanafresh.co.uk', 'Sarah Jenkins (Operations Mgr)', '02030405060708090a0b0c0d0e0f1011:2805e1ac5a52c800373c37570764052a531b9b500b253b33a651b63572ca6d00', '3344', 'MANAGER', '02035766817', 'ACTIVE', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "settle_invoices", "access_pos", "apply_discounts", "view_products", "manage_products", "edit_prices", "adjust_stock", "view_customers", "manage_customers", "adjust_credit_limit", "view_vendors", "manage_pos_intake", "view_reports", "manage_staff", "view_logs"]'),
  (3, 'alex.cashier@sanafresh.co.uk', 'Alex Rivera (Front Cashier)', '030405060708090a0b0c0d0e0f101112:80ec0e9fe7d9874127cff386768484a6f0870947782b49cbb9469e218cc0147d', '1234', 'CASHIER', '02035766818', 'ACTIVE', '["access_pos", "apply_discounts", "view_products"]'),
  (4, 'sales@sanafresh.co.uk', 'Marcus Cole (Wholesale Lead)', '0405060708090a0b0c0d0e0f10111213:85871b213cd7a14e0cde5333ced8dfbdff8b220e80819e496f5f91f93d07b6c3', '5566', 'SALES_REP', '02035766816', 'ACTIVE', '["view_invoices", "create_invoices", "edit_invoices", "settle_invoices", "view_products", "view_customers", "manage_customers"]'),
  (5, 'elena.stock@sanafresh.co.uk', 'Elena Rostova (Cold Chain Lead)', '05060708090a0b0c0d0e0f1011121314:2391280ca206e6118d762f0c2c76d9ae8f9c57a4502773ae03adf58bd3c15cfa', '7788', 'INVENTORY_CLERK', '02035766819', 'ACTIVE', '["view_products", "adjust_stock", "view_vendors", "manage_pos_intake"]');

-- 2. Categories
INSERT OR IGNORE INTO categories (id, name, code, description)
VALUES
  (1, 'Fresh Fruits & Tropicals', 'FRUIT', 'Plantains, bananas, tropicals and seasonal orchard fruits'),
  (2, 'Fresh Vegetables & Herbs', 'VEG', 'Carrots, potatoes, coriander leaves and root vegetables'),
  (3, 'Beverages & Soft Drinks', 'BEV', 'Cola, sodas, juices and refreshments in cans and bottles'),
  (4, 'Pantry, Spices & Dry Groceries', 'PANTRY', 'Coconut milk powder, seasonings, flours, grains and provisions'),
  (5, 'Dairy & Cold Chain', 'DAIRY', 'Milk, yogurt, cheeses and perishable goods');

-- 3. Products
INSERT OR IGNORE INTO products (id, sku, barcode, name, description, category_id, cost_price, retail_price, wholesale_price, min_wholesale_qty, stock_quantity, reorder_level, unit, is_active)
VALUES
  (1, 'SF-DRK-COLA', '501000100001', 'COLA ORGIN (24X330ML)', 'SANA FRESH Grade A Produce: COLA ORGIN (24X330ML)', 3, 9.50, 14.50, 12.990, 1, 120, 20, 'BX', 1),
  (2, 'SF-PRD-PLTR', '501000100002', 'PLANTAINE RIPE', 'SANA FRESH Grade A Produce: PLANTAINE RIPE', 1, 18.00, 27.50, 24.990, 1, 85, 15, 'BX', 1),
  (3, 'SF-VEG-CRT', '501000100003', 'CARROT (KG)', 'SANA FRESH Grade A Produce: CARROT (KG)', 2, 0.75, 1.45, 1.100, 1, 450, 50, 'KG', 1),
  (4, 'SF-PAN-CMP', '501000100004', 'COCNT MILK PWDR(MAGGI 6x300G)', 'SANA FRESH Grade A Produce: COCNT MILK PWDR(MAGGI 6x300G)', 4, 19.00, 27.99, 24.990, 1, 65, 10, 'BX', 1),
  (5, 'SF-HRB-COR', '501000100005', 'CORIA LEAF (BEST EA)', 'SANA FRESH Grade A Produce: CORIA LEAF (BEST EA)', 2, 0.45, 0.99, 0.799, 1, 300, 40, 'EA', 1),
  (6, 'SF-VEG-POTR', '501000100006', 'POTA RED (NSD 20KG)', 'SANA FRESH Grade A Produce: POTA RED (NSD 20KG)', 2, 14.50, 22.99, 19.990, 1, 90, 15, 'BG', 1),
  (7, 'SF-PRD-PLTG', '501000100007', 'PLANTAINE GRN (BUTT)', 'SANA FRESH Grade A Produce: PLANTAINE GRN (BUTT)', 1, 26.00, 38.50, 34.990, 1, 70, 15, 'BX', 1),
  (8, 'SF-VEG-ONR', '501000100008', 'RED ONIONS (10KG SACK)', 'SANA FRESH Grade A Produce: RED ONIONS (10KG SACK)', 2, 7.20, 11.50, 9.500, 1, 150, 25, 'BG', 1),
  (9, 'SF-VEG-TOM', '501000100009', 'PLUM TOMATOES (BOX 6KG)', 'SANA FRESH Grade A Produce: PLUM TOMATOES (BOX 6KG)', 2, 8.50, 13.99, 11.000, 1, 80, 15, 'BX', 1),
  (10, 'SF-PRD-YAM', '501000100010', 'GHANA WHITE YAM (BOX 20KG)', 'SANA FRESH Grade A Produce: GHANA WHITE YAM (BOX 20KG)', 2, 38.00, 54.00, 48.000, 1, 45, 10, 'BX', 1),
  (11, 'SF-PRD-GNG', '501000100011', 'FRESH GINGER (KG)', 'SANA FRESH Grade A Produce: FRESH GINGER (KG)', 2, 2.10, 3.80, 2.900, 1, 110, 20, 'KG', 1),
  (12, 'SF-PAN-GAR', '501000100012', 'GARLIC WHITE (BOX 10KG)', 'SANA FRESH Grade A Produce: GARLIC WHITE (BOX 10KG)', 4, 16.50, 25.00, 21.500, 1, 60, 10, 'BX', 1);

-- 4. Customers
INSERT OR IGNORE INTO customers (id, name, company_name, type, email, phone, tax_id, address, city, postal_code, country, credit_limit, current_balance, payment_terms, discount_percent, notes)
VALUES
  (1, 'Al-Rashid Halal Traders', 'Al-Rashid Halal Traders Ltd', 'WHOLESALE', 'orders@alrashidhalal.co.uk', '02071234567', 'GB-89211029', 'Eagle Yard Arch, LONDON', 'London', 'SE1 6SP', 'United Kingdom', 5000.00, 131.44, 'Due on Receipt', 0.00, 'Regular wholesale halal food and produce client in London SE1.'),
  (2, 'Barakah Grocers Croydon', 'Barakah Grocers Ltd', 'WHOLESALE', 'procure@barakahgrocers.co.uk', '02086881234', 'GB-12948201', '124 London Road', 'Croydon', 'CR0 2TB', 'United Kingdom', 15000.00, 480.00, 'NET_30', 5.00, 'South London wholesale halal retail client'),
  (3, 'Noor Fresh Market Brixton', 'Noor Fresh Foods Ltd', 'WHOLESALE', 'info@noorfresh.co.uk', '02079245678', 'GB-44910293', '45 Electric Avenue', 'Brixton', 'SW9 8JP', 'United Kingdom', 25000.00, 1250.00, 'NET_15', 3.00, 'Weekly plantain, root veg & beverage supply'),
  (4, 'Walk-in Customer', NULL, 'RETAIL', NULL, NULL, NULL, 'Counter Storefront, 94 Bensham Lane', 'Croydon', 'CR7 7ES', 'United Kingdom', 0.00, 0.00, 'Due on Receipt', 0.00, 'Standard retail walk-in customer'),
  (5, 'Yusuf Al-Amin', NULL, 'RETAIL', 'yusuf.alamin@gmail.com', '07700900123', NULL, '15 Oakwood Drive', 'Croydon', 'CR0 5TL', 'United Kingdom', 200.00, 0.00, 'Due on Receipt', 5.00, 'SANA FRESH Loyalty Club Member #402');

-- 5. Vendors
INSERT OR IGNORE INTO vendors (id, name, company_name, contact_person, email, phone, tax_id, address, payment_terms, bank_details, total_purchases)
VALUES
  (1, 'Tropical Import Direct Ltd', 'Tropical Import Direct Ltd', 'Kwame Mensah', 'supply@tropicalimports.co.uk', '02079460111', 'GB-VEND-1029', 'New Spitalfields Market, Leyton', 'NET_30', 'Barclays Bank - Sort: 20-00-00 Acc: 12345678', 45000.00),
  (2, 'Kent Farm Fresh Produce', 'Kent Horticultural Growers', 'Edward Davies', 'orders@kentfarmproduce.co.uk', '01622748111', 'GB-VEND-3391', 'Farm Lane, Maidstone, Kent', 'NET_15', 'NatWest Bank - Sort: 60-00-01 Acc: 87654321', 32000.00);

-- 6. Stock Batches & Initial Intake
INSERT OR IGNORE INTO stock_batches (id, product_id, batch_number, po_number, vendor_id, quantity_received, quantity_remaining, unit_cost, received_at, created_by)
VALUES
  (1, 1, 'BATCH-2026-COLA-01', 'PO-INIT-001', 1, 120, 120, 9.50, datetime('now'), 1),
  (2, 2, 'BATCH-2026-PLTR-01', 'PO-INIT-001', 1, 85, 85, 18.00, datetime('now'), 1),
  (3, 3, 'BATCH-2026-CRT-01',  'PO-INIT-002', 2, 450, 450, 0.75, datetime('now'), 1);

-- 7. Sales Orders & Items (Real Invoice INV-39584)
INSERT OR IGNORE INTO sales_orders (
  id, order_number, type, customer_id, staff_id, status,
  subtotal, discount_amount, tax_amount, total_amount,
  payment_method, payment_status, amount_paid,
  terms, due_date, shipping_address, notes, created_at
) VALUES (
  1, 'INV-39584', 'WHOLESALE', 1, 4, 'COMPLETED',
  131.44, 0.00, 0.00, 131.44,
  'BANK_TRANSFER', 'UNPAID', 0.00,
  'Due on Receipt', '2026-10-28', 'Eagle Yard Arch, LONDON, SE1 6SP London, United Kingdom', 'Thanks for your business.', '2026-10-28 10:30:00'
);

INSERT OR IGNORE INTO sales_order_items (id, order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total)
VALUES
  (1, 1, 1, 'COLA ORGIN (24X330ML)', 'SF-DRK-COLA', 'BX', 9.50, 12.990, 1.00, 0.00, 12.99),
  (2, 1, 2, 'PLANTAINE RIPE', 'SF-PRD-PLTR', 'BX', 18.00, 24.990, 1.00, 0.00, 24.99),
  (3, 1, 3, 'CARROT (KG)', 'SF-VEG-CRT', 'KG', 0.75, 1.100, 5.00, 0.00, 5.50),
  (4, 1, 4, 'COCNT MILK PWDR(MAGGI 6x300G)', 'SF-PAN-CMP', 'BX', 19.00, 24.990, 1.00, 0.00, 24.99),
  (5, 1, 5, 'CORIA LEAF (BEST EA)', 'SF-HRB-COR', 'EA', 0.45, 0.799, 10.00, 0.00, 7.99),
  (6, 1, 6, 'POTA RED (NSD 20KG)', 'SF-VEG-POTR', 'BG', 14.50, 19.990, 1.00, 0.00, 19.99),
  (7, 1, 7, 'PLANTAINE GRN (BUTT)', 'SF-PRD-PLTG', 'BX', 26.00, 34.990, 1.00, 0.00, 34.99);

-- POS Retail Order
INSERT OR IGNORE INTO sales_orders (
  id, order_number, type, customer_id, staff_id, status,
  subtotal, discount_amount, tax_amount, total_amount,
  payment_method, payment_status, amount_paid,
  terms, due_date, notes, created_at
) VALUES (
  2, 'POS-2026-0001', 'RETAIL', 4, 3, 'COMPLETED',
  18.49, 0.00, 0.00, 18.49,
  'CASH', 'PAID', 20.00,
  'Due on Receipt', date('now'), 'Cashier Counter Checkout', datetime('now')
);

INSERT OR IGNORE INTO sales_order_items (id, order_id, product_id, product_name, sku, unit, unit_cost, unit_price, quantity, discount, total)
VALUES
  (8, 2, 1, 'COLA ORGIN (24X330ML)', 'SF-DRK-COLA', 'BX', 9.50, 14.50, 1.00, 0.00, 14.50),
  (9, 2, 3, 'CARROT (KG)', 'SF-VEG-CRT', 'KG', 0.75, 1.45, 2.75, 0.00, 3.99);

-- 8. Customer Ledger
INSERT OR IGNORE INTO customer_ledger (id, customer_id, type, reference_number, description, debit, credit, balance, created_by, entry_date)
VALUES
  (1, 1, 'WHOLESALE_SALE', 'INV-39584', 'Wholesale Invoice INV-39584', 131.44, 0, 131.44, 4, '2026-10-28 10:30:00');

-- 9. Audit Logs
INSERT OR IGNORE INTO audit_logs (id, staff_id, staff_name, action, module, severity, details, ip_address, created_at)
VALUES
  (1, 1, 'Alexander Vance', 'SYSTEM_INITIALIZE', 'AUTH', 'INFO', '{"message": "SANA FRESH ERP Engine Ready on Cloudflare D1"}', '127.0.0.1', datetime('now')),
  (2, 4, 'Marcus Cole', 'INVOICE_ISSUED', 'WHOLESALE', 'INFO', '{"order_number": "INV-39584", "customer": "Al-Rashid Halal Traders", "total": "£131.44"}', '127.0.0.1', datetime('now'));
