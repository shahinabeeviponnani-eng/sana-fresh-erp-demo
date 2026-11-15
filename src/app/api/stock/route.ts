export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter');
    const search = searchParams.get('search');

    let sql = `
      SELECT p.id, p.sku, p.barcode, p.name, p.cost_price, p.retail_price, p.wholesale_price,
        p.stock_quantity, p.reorder_level, p.unit, c.name AS category_name,
        (p.stock_quantity * p.cost_price) AS inventory_cost_value,
        (p.stock_quantity * p.retail_price) AS potential_retail_value,
        CASE WHEN p.stock_quantity <= 0 THEN 'OUT_OF_STOCK'
             WHEN p.stock_quantity <= p.reorder_level THEN 'LOW_STOCK'
             ELSE 'IN_STOCK' END AS stock_status
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params: any[] = [];

    if (filter === 'low_stock') sql += ` AND p.stock_quantity <= p.reorder_level AND p.stock_quantity > 0`;
    else if (filter === 'out_of_stock') sql += ` AND p.stock_quantity <= 0`;

    if (search) {
      sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY p.stock_quantity ASC`;

    const [items, batches, movements, summary] = await Promise.all([
      queryAll(sql, params),
      queryAll(`
        SELECT sb.id, sb.product_id, sb.batch_number, sb.po_number,
          sb.quantity_received, sb.quantity_remaining, sb.unit_cost, sb.received_at,
          v.company_name AS vendor_name
        FROM stock_batches sb LEFT JOIN vendors v ON sb.vendor_id = v.id
        WHERE sb.quantity_remaining > 0 ORDER BY sb.product_id, sb.received_at ASC
      `),
      queryAll(`
        SELECT sm.id, sm.product_id, sm.type AS movement_type, sm.type, sm.quantity AS quantity_change,
          sm.quantity, sm.previous_stock AS quantity_before, sm.new_stock AS quantity_after,
          sm.reference_id, sm.reason, sm.created_at AS movement_date, sm.created_at,
          p.name AS product_name, p.sku, p.unit, u.name AS staff_name
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN users u ON sm.staff_id = u.id
        ORDER BY sm.created_at DESC LIMIT 200
      `),
      queryOne(`
        SELECT COUNT(*) AS total_items, COALESCE(SUM(stock_quantity), 0) AS total_units,
          COALESCE(SUM(stock_quantity * cost_price), 0) AS total_cost_value,
          COALESCE(SUM(stock_quantity * retail_price), 0) AS total_retail_value,
          COUNT(CASE WHEN stock_quantity <= reorder_level THEN 1 END) AS low_stock_count,
          COUNT(CASE WHEN stock_quantity <= 0 THEN 1 END) AS out_of_stock_count
        FROM products WHERE is_active = 1
      `),
    ]);

    return NextResponse.json({ items, batches, movements, summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
