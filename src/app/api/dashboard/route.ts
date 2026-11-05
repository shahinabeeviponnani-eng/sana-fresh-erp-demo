import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // 1. Total revenue breakdown
    const revenueRes = await query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN type = 'RETAIL' THEN total_amount ELSE 0 END), 0) AS retail_revenue,
        COALESCE(SUM(CASE WHEN type = 'WHOLESALE' THEN total_amount ELSE 0 END), 0) AS wholesale_revenue,
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN payment_status = 'UNPAID' OR payment_status = 'PARTIAL' THEN (total_amount - amount_paid) ELSE 0 END), 0) AS outstanding_receivables
      FROM sales_orders
      WHERE status != 'CANCELLED';
    `);

    // 2. Inventory summary & Low stock count
    const stockRes = await query(`
      SELECT 
        COUNT(*) AS total_products,
        COALESCE(SUM(stock_quantity), 0) AS total_units_in_stock,
        COALESCE(SUM(stock_quantity * cost_price), 0) AS inventory_valuation,
        COUNT(CASE WHEN stock_quantity <= reorder_level THEN 1 END) AS low_stock_count
      FROM products
      WHERE is_active = true;
    `);

    // 3. Customer breakdown
    const customerRes = await query(`
      SELECT 
        COUNT(*) AS total_customers,
        COUNT(CASE WHEN type = 'WHOLESALE' THEN 1 END) AS wholesale_customers,
        COUNT(CASE WHEN type = 'RETAIL' THEN 1 END) AS retail_customers,
        COALESCE(SUM(current_balance), 0) AS total_credit_extended
      FROM customers;
    `);

    // 4. Recent sales orders (Retail + Wholesale)
    const recentOrdersRes = await query(`
      SELECT 
        so.id,
        so.order_number,
        so.type,
        so.status,
        so.payment_method,
        so.payment_status,
        so.total_amount,
        so.amount_paid,
        so.created_at,
        COALESCE(c.name, 'Walk-in') AS customer_name,
        COALESCE(c.company_name, '') AS customer_company,
        u.name AS staff_name
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u ON so.staff_id = u.id
      ORDER BY so.created_at DESC
      LIMIT 6;
    `);

    // 5. Recent audit logs
    const recentLogsRes = await query(`
      SELECT id, staff_name, action, module, severity, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 6;
    `);

    // 6. Products running low on stock
    const lowStockItemsRes = await query(`
      SELECT p.id, p.sku, p.name, p.stock_quantity, p.reorder_level, p.unit, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.stock_quantity <= p.reorder_level AND p.is_active = true
      ORDER BY p.stock_quantity ASC
      LIMIT 5;
    `);

    return NextResponse.json({
      metrics: {
        totalRevenue: Number(revenueRes.rows[0].total_revenue),
        retailRevenue: Number(revenueRes.rows[0].retail_revenue),
        wholesaleRevenue: Number(revenueRes.rows[0].wholesale_revenue),
        totalOrders: Number(revenueRes.rows[0].total_orders),
        outstandingReceivables: Number(revenueRes.rows[0].outstanding_receivables),
        totalProducts: Number(stockRes.rows[0].total_products),
        totalUnitsInStock: Number(stockRes.rows[0].total_units_in_stock),
        inventoryValuation: Number(stockRes.rows[0].inventory_valuation),
        lowStockCount: Number(stockRes.rows[0].low_stock_count),
        totalCustomers: Number(customerRes.rows[0].total_customers),
        wholesaleCustomers: Number(customerRes.rows[0].wholesale_customers),
        retailCustomers: Number(customerRes.rows[0].retail_customers),
        totalCreditExtended: Number(customerRes.rows[0].total_credit_extended),
      },
      recentOrders: recentOrdersRes.rows,
      recentLogs: recentLogsRes.rows,
      lowStockItems: lowStockItemsRes.rows,
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
