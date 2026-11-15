export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getUserFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });

  const like = `%${q}%`;

  const [invoices, products, customers, staff] = await Promise.all([
    queryAll(`
      SELECT so.id, so.order_number, so.type, so.total_amount, so.payment_status, so.created_at,
        COALESCE(c.company_name, c.name, 'Walk-in') AS customer_name
      FROM sales_orders so LEFT JOIN customers c ON so.customer_id=c.id
      WHERE so.order_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ?
      ORDER BY so.created_at DESC LIMIT 5
    `, [like, like, like]),
    queryAll(`
      SELECT id, sku, name, stock_quantity, unit, retail_price, wholesale_price
      FROM products WHERE (name LIKE ? OR sku LIKE ? OR barcode LIKE ?) AND is_active=1
      ORDER BY name LIMIT 5
    `, [like, like, like]),
    queryAll(`
      SELECT id, name, company_name, type, email, phone, current_balance, credit_limit
      FROM customers WHERE name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?
      ORDER BY name LIMIT 5
    `, [like, like, like, like]),
    queryAll(`
      SELECT id, name, role, email, status FROM users
      WHERE name LIKE ? OR email LIKE ? ORDER BY name LIMIT 3
    `, [like, like]),
  ]);

  return NextResponse.json({ results: { invoices, products, customers, staff }, query: q });
}
