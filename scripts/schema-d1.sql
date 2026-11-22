-- SANA FRESH ERP — D1 (SQLite) Schema
-- Run: wrangler d1 execute sana-fresh-erp-db --file=scripts/schema-d1.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  pin_code TEXT,
  role TEXT NOT NULL DEFAULT 'CASHIER',
  phone TEXT,
  permissions TEXT DEFAULT '[]',
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  cost_price REAL NOT NULL DEFAULT 0,
  retail_price REAL NOT NULL DEFAULT 0,
  wholesale_price REAL NOT NULL DEFAULT 0,
  retail_margin_percent REAL DEFAULT 0,
  wholesale_margin_percent REAL DEFAULT 0,
  min_wholesale_qty REAL NOT NULL DEFAULT 1,
  stock_quantity REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 15,
  unit TEXT DEFAULT 'BX',
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_name TEXT,
  type TEXT NOT NULL DEFAULT 'RETAIL',
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'United Kingdom',
  credit_limit REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  payment_terms TEXT DEFAULT 'Due on Receipt',
  discount_percent REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  address TEXT,
  payment_terms TEXT DEFAULT 'NET_30',
  bank_details TEXT,
  notes TEXT,
  total_purchases REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'RETAIL',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  subtotal REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'CASH',
  payment_status TEXT DEFAULT 'PAID',
  amount_paid REAL DEFAULT 0,
  terms TEXT DEFAULT 'Due on Receipt',
  due_date TEXT,
  shipping_address TEXT,
  notes TEXT,
  card_reference TEXT,
  split_payments TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  unit TEXT,
  unit_cost REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL,
  quantity REAL NOT NULL,
  discount REAL DEFAULT 0,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE NOT NULL,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE RESTRICT,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ORDERED',
  total_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'UNPAID',
  amount_paid REAL DEFAULT 0,
  card_reference TEXT,
  expected_delivery_date TEXT,
  received_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
  quantity_ordered REAL NOT NULL,
  quantity_received REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  previous_stock REAL NOT NULL,
  new_stock REAL NOT NULL,
  reference_id TEXT,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  batch_number TEXT UNIQUE NOT NULL,
  po_number TEXT,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  quantity_received REAL NOT NULL,
  quantity_remaining REAL NOT NULL,
  unit_cost REAL NOT NULL,
  received_at TEXT DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  staff_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  severity TEXT DEFAULT 'INFO',
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS salary_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  role TEXT NOT NULL,
  pay_period_start TEXT NOT NULL,
  pay_period_end TEXT NOT NULL,
  basic_salary REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  net_pay REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'BANK_TRANSFER',
  payment_status TEXT DEFAULT 'PENDING',
  notes TEXT,
  paid_at TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  reference_number TEXT,
  description TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entry_date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendor_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  reference_number TEXT,
  description TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entry_date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT UNIQUE NOT NULL,
  original_po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  original_po_number TEXT,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  total_credit REAL NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  return_date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  credit_amount REAL NOT NULL,
  batch_id INTEGER REFERENCES stock_batches(id) ON DELETE SET NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS sales_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT UNIQUE NOT NULL,
  original_order_id INTEGER REFERENCES sales_orders(id) ON DELETE SET NULL,
  original_order_number TEXT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  total_refund REAL NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  return_date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  refund_amount REAL NOT NULL,
  batch_id INTEGER REFERENCES stock_batches(id) ON DELETE SET NULL,
  disposition TEXT DEFAULT 'RESTOCK',
  damage_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_type ON sales_orders(type);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created ON sales_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_orders_payment_status ON sales_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor ON vendor_ledger(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_product ON stock_batches(product_id);
