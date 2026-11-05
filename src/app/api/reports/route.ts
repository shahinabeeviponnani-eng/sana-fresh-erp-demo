import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('range') || '30days';

    // 1. Channel Performance (Retail vs Wholesale)
    const channelRes = await query(`
      SELECT 
        so.type,
        COUNT(DISTINCT so.id) AS order_count,
        COALESCE(SUM(so.total_amount), 0) AS total_revenue,
        COALESCE(SUM(so.tax_amount), 0) AS total_tax,
        COALESCE(SUM(soi.quantity * soi.unit_cost), 0) AS total_cogs,
        COALESCE(SUM(so.total_amount) - SUM(soi.quantity * soi.unit_cost), 0) AS gross_profit,
        CASE 
          WHEN SUM(so.total_amount) > 0 THEN 
            ROUND(((SUM(so.total_amount) - SUM(soi.quantity * soi.unit_cost)) / SUM(so.total_amount) * 100)::numeric, 1)
          ELSE 0 
        END AS margin_percentage
      FROM sales_orders so
      JOIN sales_order_items soi ON soi.order_id = so.id
      WHERE so.status != 'CANCELLED'
      GROUP BY so.type;
    `);

    // 2. Category Performance
    const categoryRes = await query(`
      SELECT 
        c.name AS category_name,
        COALESCE(SUM(soi.quantity), 0) AS units_sold,
        COALESCE(SUM(soi.total), 0) AS total_revenue
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      LEFT JOIN sales_order_items soi ON soi.product_id = p.id
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC;
    `);

    // 3. Top 10 Best Sellers
    const topProductsRes = await query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        c.name AS category_name,
        SUM(soi.quantity) AS total_quantity_sold,
        SUM(soi.total) AS total_revenue_generated,
        SUM(soi.total) - SUM(soi.quantity * soi.unit_cost) AS gross_profit
      FROM sales_order_items soi
      JOIN products p ON soi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      GROUP BY p.id, p.sku, p.name, c.name
      ORDER BY total_revenue_generated DESC
      LIMIT 10;
    `);

    // 4. Monthly / Daily Sales Trend (Mocked + Real aggregation)
    const salesTrendRes = await query(`
      SELECT 
        TO_CHAR(so.created_at, 'Mon DD') AS date_label,
        DATE(so.created_at) AS raw_date,
        COALESCE(SUM(CASE WHEN so.type = 'RETAIL' THEN so.total_amount ELSE 0 END), 0) AS retail_sales,
        COALESCE(SUM(CASE WHEN so.type = 'WHOLESALE' THEN so.total_amount ELSE 0 END), 0) AS wholesale_sales,
        COALESCE(SUM(so.total_amount), 0) AS total_sales
      FROM sales_orders so
      WHERE so.status != 'CANCELLED'
      GROUP BY DATE(so.created_at), TO_CHAR(so.created_at, 'Mon DD')
      ORDER BY raw_date ASC
      LIMIT 30;
    `);

    // 5. Customer Receivables & Debt Aging
    const receivablesRes = await query(`
      SELECT 
        COUNT(CASE WHEN current_balance > 0 THEN 1 END) AS customers_with_debt,
        COALESCE(SUM(current_balance), 0) AS total_outstanding,
        COALESCE(SUM(credit_limit), 0) AS total_credit_limit,
        ROUND((COALESCE(SUM(current_balance), 0) / NULLIF(SUM(credit_limit), 0) * 100)::numeric, 1) AS credit_utilization_percent
      FROM customers
      WHERE type = 'WHOLESALE';
    `);

    return NextResponse.json({
      channels: channelRes.rows,
      categories: categoryRes.rows,
      topProducts: topProductsRes.rows,
      salesTrend: salesTrendRes.rows,
      receivables: receivablesRes.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
