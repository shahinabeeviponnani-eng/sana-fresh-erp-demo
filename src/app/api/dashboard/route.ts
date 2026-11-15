export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const [revenue, stock, customers, recentOrders, recentLogs, lowStock] = await Promise.all([
      queryOne(`
        SELECT COALESCE(SUM(total_amount),0) AS total_revenue,
          COALESCE(SUM(CASE WHEN type='RETAIL' THEN total_amount ELSE 0 END),0) AS retail_revenue,
          COALESCE(SUM(CASE WHEN type='WHOLESALE' THEN total_amount ELSE 0 END),0) AS wholesale_revenue,
          COUNT(*) AS total_orders,
          COALESCE(SUM(CASE WHEN payment_status IN ('UNPAID','PARTIAL') THEN total_amount-amount_paid ELSE 0 END),0) AS outstanding_receivables
        FROM sales_orders WHERE status!='CANCELLED'
      `),
      queryOne(`
        SELECT COUNT(*) AS total_products, COALESCE(SUM(stock_quantity),0) AS total_units_in_stock,
          COALESCE(SUM(stock_quantity*cost_price),0) AS inventory_valuation,
          COUNT(CASE WHEN stock_quantity<=reorder_level THEN 1 END) AS low_stock_count
        FROM products WHERE is_active=1
      `),
      queryOne(`
        SELECT COUNT(*) AS total_customers,
          COUNT(CASE WHEN type='WHOLESALE' THEN 1 END) AS wholesale_customers,
          COUNT(CASE WHEN type='RETAIL' THEN 1 END) AS retail_customers,
          COALESCE(SUM(current_balance),0) AS total_credit_extended
        FROM customers
      `),
      queryAll(`
        SELECT so.id, so.order_number, so.type, so.status, so.payment_method,
          so.payment_status, so.total_amount, so.amount_paid, so.created_at,
          COALESCE(c.name,'Walk-in') AS customer_name, COALESCE(c.company_name,'') AS customer_company,
          u.name AS staff_name
        FROM sales_orders so
        LEFT JOIN customers c ON so.customer_id=c.id
        LEFT JOIN users u ON so.staff_id=u.id
        ORDER BY so.created_at DESC LIMIT 6
      `),
      queryAll(`SELECT id, staff_name, action, module, severity, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 6`),
      queryAll(`
        SELECT p.id, p.sku, p.name, p.stock_quantity, p.reorder_level, p.unit, c.name AS category_name
        FROM products p LEFT JOIN categories c ON p.category_id=c.id
        WHERE p.stock_quantity<=p.reorder_level AND p.is_active=1
        ORDER BY p.stock_quantity ASC LIMIT 5
      `),
    ]);

    // Parse details JSON for logs
    const parsedLogs = recentLogs.map((l: any) => ({ ...l, details: l.details ? (() => { try { return JSON.parse(l.details); } catch { return l.details; } })() : null }));

    return NextResponse.json({
      metrics: {
        totalRevenue: Number(revenue?.total_revenue || 0),
        retailRevenue: Number(revenue?.retail_revenue || 0),
        wholesaleRevenue: Number(revenue?.wholesale_revenue || 0),
        totalOrders: Number(revenue?.total_orders || 0),
        outstandingReceivables: Number(revenue?.outstanding_receivables || 0),
        totalProducts: Number(stock?.total_products || 0),
        totalUnitsInStock: Number(stock?.total_units_in_stock || 0),
        inventoryValuation: Number(stock?.inventory_valuation || 0),
        lowStockCount: Number(stock?.low_stock_count || 0),
        totalCustomers: Number(customers?.total_customers || 0),
        wholesaleCustomers: Number(customers?.wholesale_customers || 0),
        retailCustomers: Number(customers?.retail_customers || 0),
        totalCreditExtended: Number(customers?.total_credit_extended || 0),
      },
      recentOrders,
      recentLogs: parsedLogs,
      lowStockItems: lowStock,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
