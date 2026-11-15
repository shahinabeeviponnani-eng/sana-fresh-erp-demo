export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'view_reports')) {
      return NextResponse.json({ error: 'Access Denied: view_reports permission required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('range') || '30days';

    // Map range param to SQLite datetime modifier
    const intervalMap: Record<string, string | null> = {
      '7days': '-7 days',
      '30days': '-30 days',
      '90days': '-90 days',
      '12months': '-12 months',
      'all': null,
    };
    const interval = intervalMap[timeRange] ?? '-30 days';
    const dateFilter = interval ? `AND so.created_at >= datetime('now', '${interval}')` : '';

    // 1. Channel Performance (Retail vs Wholesale) — UK £
    const channels = await queryAll(`
      SELECT 
        so.type,
        COUNT(DISTINCT so.id) AS order_count,
        COALESCE(SUM(so.total_amount), 0) AS total_revenue,
        COALESCE(SUM(so.tax_amount), 0) AS total_tax,
        COALESCE(SUM(soi.quantity * soi.unit_cost), 0) AS total_cogs,
        COALESCE(SUM(so.total_amount) - SUM(soi.quantity * soi.unit_cost), 0) AS gross_profit,
        CASE 
          WHEN SUM(so.total_amount) > 0 THEN 
            ROUND(((SUM(so.total_amount) - SUM(soi.quantity * soi.unit_cost)) / SUM(so.total_amount) * 100), 1)
          ELSE 0 
        END AS margin_percentage
      FROM sales_orders so
      JOIN sales_order_items soi ON soi.order_id = so.id
      WHERE so.status != 'CANCELLED' ${dateFilter}
      GROUP BY so.type;
    `);

    // 2. Category Performance
    const categories = await queryAll(`
      SELECT 
        c.name AS category_name,
        COALESCE(SUM(soi.quantity), 0) AS units_sold,
        COALESCE(SUM(soi.total), 0) AS total_revenue
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      LEFT JOIN sales_order_items soi ON soi.product_id = p.id
      LEFT JOIN sales_orders so ON soi.order_id = so.id AND so.status != 'CANCELLED' ${dateFilter}
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC;
    `);

    // 3. Top 10 Best Sellers
    const topProducts = await queryAll(`
      SELECT 
        p.id, p.sku, p.name,
        c.name AS category_name,
        SUM(soi.quantity) AS total_quantity_sold,
        SUM(soi.total) AS total_revenue_generated,
        SUM(soi.total) - SUM(soi.quantity * soi.unit_cost) AS gross_profit
      FROM sales_order_items soi
      JOIN products p ON soi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN sales_orders so ON soi.order_id = so.id AND so.status != 'CANCELLED' ${dateFilter}
      GROUP BY p.id, p.sku, p.name, c.name
      ORDER BY total_revenue_generated DESC
      LIMIT 10;
    `);

    // 4. Daily Sales Trend
    const salesTrend = await queryAll(`
      SELECT 
        strftime('%d %m', so.created_at) AS date_label,
        date(so.created_at) AS raw_date,
        COALESCE(SUM(CASE WHEN so.type = 'RETAIL' THEN so.total_amount ELSE 0 END), 0) AS retail_sales,
        COALESCE(SUM(CASE WHEN so.type = 'WHOLESALE' THEN so.total_amount ELSE 0 END), 0) AS wholesale_sales,
        COALESCE(SUM(so.total_amount), 0) AS total_sales
      FROM sales_orders so
      WHERE so.status != 'CANCELLED' ${dateFilter}
      GROUP BY date(so.created_at)
      ORDER BY raw_date ASC
      LIMIT 90;
    `);

    // 5. Wholesale Receivables & Debt Aging
    const receivables = await queryOne(`
      SELECT 
        COUNT(CASE WHEN current_balance > 0 THEN 1 END) AS customers_with_debt,
        COALESCE(SUM(current_balance), 0) AS total_outstanding,
        COALESCE(SUM(credit_limit), 0) AS total_credit_limit,
        ROUND(COALESCE(SUM(current_balance), 0) * 100.0 / NULLIF(SUM(credit_limit), 0), 1) AS credit_utilization_percent
      FROM customers
      WHERE type = 'WHOLESALE';
    `);

    // 6. Debt Aging Breakdown (UK standard: 0-30, 31-60, 61-90, 90+ days)
    const debtAging = await queryOne(`
      SELECT
        COALESCE(SUM(CASE WHEN due_date >= datetime('now', '-30 days') OR due_date IS NULL THEN (total_amount - amount_paid) ELSE 0 END), 0) AS current_0_30,
        COALESCE(SUM(CASE WHEN due_date < datetime('now', '-30 days') AND due_date >= datetime('now', '-60 days') THEN (total_amount - amount_paid) ELSE 0 END), 0) AS overdue_31_60,
        COALESCE(SUM(CASE WHEN due_date < datetime('now', '-60 days') AND due_date >= datetime('now', '-90 days') THEN (total_amount - amount_paid) ELSE 0 END), 0) AS overdue_61_90,
        COALESCE(SUM(CASE WHEN due_date < datetime('now', '-90 days') THEN (total_amount - amount_paid) ELSE 0 END), 0) AS overdue_90_plus
      FROM sales_orders
      WHERE type = 'WHOLESALE' AND payment_status IN ('UNPAID', 'PARTIAL') AND status != 'CANCELLED';
    `);

    // 7. Staff Sales Performance
    const staffPerformance = await queryAll(`
      SELECT 
        u.name AS staff_name,
        u.role,
        COUNT(DISTINCT so.id) AS total_orders,
        COALESCE(SUM(so.total_amount), 0) AS total_revenue
      FROM sales_orders so
      JOIN users u ON so.staff_id = u.id
      WHERE so.status != 'CANCELLED' ${dateFilter}
      GROUP BY u.id, u.name, u.role
      ORDER BY total_revenue DESC
      LIMIT 10;
    `);

    return NextResponse.json({
      channels,
      categories,
      topProducts,
      salesTrend,
      receivables: receivables || {},
      debtAging: debtAging || {},
      staffPerformance,
      timeRange,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
