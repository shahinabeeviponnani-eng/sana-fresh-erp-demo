export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!checkUserPermission(user.role, user.permissions, 'view_reports')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30', 10);
  const since = `datetime('now', '-${days} days')`;

  const [turnover, slowMovers, deadStock, categoryBreakdown, movementTrend, topReceived] = await Promise.all([

    // Stock turnover: units sold vs avg stock
    queryAll(`
      SELECT
        p.id, p.sku, p.name, p.unit, p.stock_quantity, p.reorder_level,
        p.cost_price, p.retail_price,
        c.name AS category_name,
        COALESCE(SUM(ABS(sm.quantity)), 0) AS units_sold,
        COALESCE(SUM(ABS(sm.quantity)) * p.cost_price, 0) AS cogs_value,
        COALESCE(SUM(ABS(sm.quantity)) * p.retail_price, 0) AS revenue_value,
        CASE WHEN p.stock_quantity > 0
          THEN ROUND((COALESCE(SUM(ABS(sm.quantity)), 0) * 1.0 / NULLIF(p.stock_quantity, 0)), 2)
          ELSE 0
        END AS turnover_ratio
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
        AND sm.type IN ('RETAIL_SALE','WHOLESALE_SALE')
        AND sm.created_at >= ${since}
      WHERE p.is_active = 1
      GROUP BY p.id, p.sku, p.name, p.unit, p.stock_quantity, p.reorder_level, p.cost_price, p.retail_price, c.name
      ORDER BY units_sold DESC
      LIMIT 20
    `),

    // Slow movers: in stock but low sales in period
    queryAll(`
      SELECT
        p.id, p.sku, p.name, p.unit, p.stock_quantity, p.cost_price,
        c.name AS category_name,
        COALESCE(SUM(ABS(sm.quantity)), 0) AS units_sold_period,
        (p.stock_quantity * p.cost_price) AS stock_value_at_risk
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
        AND sm.type IN ('RETAIL_SALE','WHOLESALE_SALE')
        AND sm.created_at >= ${since}
      WHERE p.is_active = 1 AND p.stock_quantity > p.reorder_level
      GROUP BY p.id, p.sku, p.name, p.unit, p.stock_quantity, p.cost_price, c.name
      HAVING COALESCE(SUM(ABS(sm.quantity)), 0) < 5
      ORDER BY stock_value_at_risk DESC
      LIMIT 15
    `),

    // Dead stock: no movement at all in last 60 days
    queryAll(`
      SELECT
        p.id, p.sku, p.name, p.unit, p.stock_quantity, p.cost_price,
        c.name AS category_name,
        (p.stock_quantity * p.cost_price) AS dead_stock_value,
        MAX(sm.created_at) AS last_movement
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE p.is_active = 1 AND p.stock_quantity > 0
      GROUP BY p.id, p.sku, p.name, p.unit, p.stock_quantity, p.cost_price, c.name
      HAVING MAX(sm.created_at) < datetime('now', '-60 days') OR MAX(sm.created_at) IS NULL
      ORDER BY dead_stock_value DESC
      LIMIT 15
    `),

    // Category stock breakdown
    queryAll(`
      SELECT
        COALESCE(c.name, 'Uncategorised') AS category_name,
        COUNT(p.id) AS product_count,
        COALESCE(SUM(p.stock_quantity), 0) AS total_units,
        COALESCE(SUM(p.stock_quantity * p.cost_price), 0) AS total_cost_value,
        COALESCE(SUM(p.stock_quantity * p.retail_price), 0) AS total_retail_value,
        COUNT(CASE WHEN p.stock_quantity <= p.reorder_level THEN 1 END) AS low_stock_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      GROUP BY c.name
      ORDER BY total_cost_value DESC
    `),

    // Daily movement trend (in vs out)
    queryAll(`
      SELECT
        date(created_at) AS day,
        COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS stock_in,
        COALESCE(SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END), 0) AS stock_out
      FROM stock_movements
      WHERE created_at >= ${since}
      GROUP BY date(created_at)
      ORDER BY day ASC
    `),

    // Top received (restocked) products
    queryAll(`
      SELECT
        p.id, p.sku, p.name, p.unit,
        COALESCE(SUM(sm.quantity), 0) AS total_received
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE sm.type = 'PURCHASE_RECEIVE' AND sm.created_at >= ${since}
      GROUP BY p.id, p.sku, p.name, p.unit
      ORDER BY total_received DESC
      LIMIT 10
    `),
  ]);

  return NextResponse.json({
    turnover,
    slowMovers,
    deadStock,
    categoryBreakdown,
    movementTrend,
    topReceived,
    days,
  });
}
