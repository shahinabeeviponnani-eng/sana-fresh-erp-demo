const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let dbUrl = 'postgresql://postgres:soundofheart@localhost:5432/erp_db';
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) dbUrl = match[1];
  }
} catch (e) {}

const pool = new Pool({ connectionString: dbUrl });

async function runHealthCheck() {
  console.log('====================================================');
  console.log('       SANA FRESH ERP - SYSTEM HEALTH AUDIT         ');
  console.log('====================================================');

  try {
    // 1. Check DB Connection
    const client = await pool.connect();
    console.log('✓ Database connection: OK');
    client.release();

    // 2. Table row counts
    const tables = [
      'users',
      'categories',
      'products',
      'customers',
      'vendors',
      'sales_orders',
      'sales_order_items',
      'stock_movements',
      'purchase_orders',
      'purchase_order_items',
      'audit_logs'
    ];

    console.log('\n--- Table Records Count ---');
    for (const tbl of tables) {
      const res = await pool.query('SELECT COUNT(*) as count FROM ' + tbl);
      console.log(`• ${tbl.padEnd(24)}: ${res.rows[0].count} records`);
    }

    // 3. Check Users and Permissions
    console.log('\n--- Staff Accounts & Permission Sets ---');
    const userRes = await pool.query('SELECT id, name, email, role, jsonb_array_length(permissions) as perm_count, status FROM users ORDER BY id');
    console.table(userRes.rows);

    // 4. Check Wholesale Orders (Real bill check)
    console.log('\n--- Wholesale Bills (INV-39584 check) ---');
    const orderRes = await pool.query(`
      SELECT 
        so.id, so.order_number, so.total_amount, so.tax_amount, so.payment_status, so.terms, c.name as customer_name,
        COUNT(soi.id) as item_count
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN sales_order_items soi ON soi.order_id = so.id
      WHERE so.type = 'WHOLESALE'
      GROUP BY so.id, so.order_number, so.total_amount, so.tax_amount, so.payment_status, so.terms, c.name
      ORDER BY so.id ASC
    `);
    console.table(orderRes.rows);

    // 5. Check real bill INV-39584 items
    console.log('\n--- Real Bill INV-39584 Item Breakdown ---');
    const itemsRes = await pool.query(`
      SELECT 
        soi.product_name, soi.sku, soi.unit, soi.quantity, soi.unit_price, soi.total
      FROM sales_order_items soi
      JOIN sales_orders so ON so.id = soi.order_id
      WHERE so.order_number = 'INV-39584'
      ORDER BY soi.id ASC
    `);
    console.table(itemsRes.rows);

    // 6. Check Products & 2/3 decimal pricing + units
    console.log('\n--- Produce Units & Precision Check ---');
    const prodRes = await pool.query(`
      SELECT name, sku, unit, wholesale_price, retail_price, stock_quantity 
      FROM products 
      WHERE unit IN ('BX', 'KG', 'EA', 'BG', 'PK') 
      LIMIT 6
    `);
    console.table(prodRes.rows);

    // 7. Check Audit Logs
    console.log('\n--- Audit Logs Sample ---');
    const auditRes = await pool.query('SELECT id, staff_name, action, module, created_at FROM audit_logs ORDER BY id DESC LIMIT 5');
    console.table(auditRes.rows);

    console.log('\n✓ ALL DATABASE HEALTH CHECKS PASSED');
  } catch (err) {
    console.error('❌ Health check error:', err);
  } finally {
    await pool.end();
  }
}

runHealthCheck();
