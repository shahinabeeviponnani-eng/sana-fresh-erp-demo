export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const paymentMethod = searchParams.get('paymentMethod') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    let where = `WHERE so.type='RETAIL'`;
    const params: any[] = [];

    if (search) { where += ` AND (so.order_number LIKE ? OR c.name LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
    if (paymentMethod) { where += ` AND so.payment_method=?`; params.push(paymentMethod); }
    if (dateFrom) { where += ` AND so.created_at>=?`; params.push(dateFrom); }
    if (dateTo) { where += ` AND so.created_at<?`; params.push(dateTo + 'T23:59:59'); }

    const countRow = await queryOne(
      `SELECT COUNT(*) AS cnt FROM sales_orders so LEFT JOIN customers c ON so.customer_id=c.id ${where}`,
      params
    );
    const total = Number(countRow?.cnt || 0);

    const sales = await queryAll(
      `SELECT so.id, so.order_number, so.subtotal, so.discount_amount, so.tax_amount,
        so.total_amount, so.payment_method, so.payment_status, so.amount_paid,
        so.card_reference, so.split_payments, so.notes, so.created_at,
        c.name AS customer_name, u.name AS staff_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id=c.id
       LEFT JOIN users u ON so.staff_id=u.id
       ${where} ORDER BY so.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Attach items
    for (const sale of sales) {
      sale.items = await queryAll(
        `SELECT id, product_id AS productId, product_name AS productName, sku, unit,
          quantity, unit_price AS unitPrice, discount, total
         FROM sales_order_items WHERE order_id=? ORDER BY id ASC`,
        [sale.id]
      );
      if (sale.split_payments) {
        try { sale.split_payments = JSON.parse(sale.split_payments); } catch { sale.split_payments = null; }
      }
    }

    return NextResponse.json({ sales, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
