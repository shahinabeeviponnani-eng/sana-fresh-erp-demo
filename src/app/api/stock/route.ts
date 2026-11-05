import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter'); // 'low_stock', 'out_of_stock', 'all'
    const search = searchParams.get('search');

    let sql = `
      SELECT 
        p.id, p.sku, p.barcode, p.name, p.cost_price, p.retail_price, p.wholesale_price,
        p.stock_quantity, p.reorder_level, p.unit,
        c.name AS category_name,
        (p.stock_quantity * p.cost_price) AS inventory_cost_value,
        (p.stock_quantity * p.retail_price) AS potential_retail_value,
        CASE 
          WHEN p.stock_quantity <= 0 THEN 'OUT_OF_STOCK'
          WHEN p.stock_quantity <= p.reorder_level THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END AS stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const params: any[] = [];

    if (filter === 'low_stock') {
      sql += ` AND p.stock_quantity <= p.reorder_level AND p.stock_quantity > 0`;
    } else if (filter === 'out_of_stock') {
      sql += ` AND p.stock_quantity <= 0`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
    }

    sql += ` ORDER BY p.stock_quantity ASC`;

    const stockRes = await query(sql, params);

    // Recent stock movements ledger
    const movementsRes = await query(`
      SELECT 
        sm.id, sm.type, sm.quantity, sm.previous_stock, sm.new_stock,
        sm.reference_id, sm.reason, sm.created_at,
        p.name AS product_name, p.sku, p.unit,
        u.name AS staff_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.staff_id = u.id
      ORDER BY sm.created_at DESC
      LIMIT 20;
    `);

    // High level inventory metrics
    const totalsRes = await query(`
      SELECT 
        COUNT(*) AS total_items,
        COALESCE(SUM(stock_quantity), 0) AS total_units,
        COALESCE(SUM(stock_quantity * cost_price), 0) AS total_cost_value,
        COALESCE(SUM(stock_quantity * retail_price), 0) AS total_retail_value,
        COUNT(CASE WHEN stock_quantity <= reorder_level THEN 1 END) AS low_stock_count,
        COUNT(CASE WHEN stock_quantity <= 0 THEN 1 END) AS out_of_stock_count
      FROM products
      WHERE is_active = true;
    `);

    return NextResponse.json({
      items: stockRes.rows,
      movements: movementsRes.rows,
      summary: totalsRes.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
