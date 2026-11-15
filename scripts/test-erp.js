const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:soundofheart@localhost:5432/erp_db' });

let passed = 0;
let failed = 0;
const errors = [];

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} ${detail}`);
    failed++;
    errors.push(`${label} ${detail}`);
  }
}

function near(a, b, tol = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

async function getStock(client, productId) {
  const r = await client.query('SELECT stock_quantity FROM products WHERE id = $1', [productId]);
  return Number(r.rows[0]?.stock_quantity || 0);
}

async function getCustomerBalance(client, customerId) {
  const r = await client.query('SELECT current_balance FROM customers WHERE id = $1', [customerId]);
  return Number(r.rows[0]?.current_balance || 0);
}

async function getLastLedgerEntry(client, customerId) {
  const r = await client.query(
    'SELECT * FROM customer_ledger WHERE customer_id = $1 ORDER BY entry_date DESC LIMIT 1',
    [customerId]
  );
  return r.rows[0];
}

async function getLastVendorLedger(client, vendorId) {
  const r = await client.query(
    'SELECT * FROM vendor_ledger WHERE vendor_id = $1 ORDER BY entry_date DESC LIMIT 1',
    [vendorId]
  );
  return r.rows[0];
}

async function cleanup(client) {
  await client.query(`
    DELETE FROM stock_movements WHERE reference_id LIKE 'TEST-%';
    DELETE FROM customer_ledger WHERE reference_number LIKE 'TEST-%';
    DELETE FROM vendor_ledger WHERE reference_number LIKE 'TEST-%';
    DELETE FROM sales_return_items WHERE return_id IN (SELECT id FROM sales_returns WHERE return_number LIKE 'TEST-%');
    DELETE FROM sales_returns WHERE return_number LIKE 'TEST-%';
    DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE return_number LIKE 'TEST-%');
    DELETE FROM purchase_returns WHERE return_number LIKE 'TEST-%';
    DELETE FROM sales_order_items WHERE order_id IN (SELECT id FROM sales_orders WHERE order_number LIKE 'TEST-%');
    DELETE FROM sales_orders WHERE order_number LIKE 'TEST-%';
    DELETE FROM purchase_order_items WHERE po_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE 'TEST-%');
    DELETE FROM purchase_orders WHERE po_number LIKE 'TEST-%';
    DELETE FROM stock_batches WHERE po_number LIKE 'TEST-%';
  `);
}

module.exports = { pool, assert, near, getStock, getCustomerBalance, getLastLedgerEntry, getLastVendorLedger, cleanup };
