export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId, getDB } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const customerId = parseInt(params.id);

    const [customer, ledger, summary, orders, returns] = await Promise.all([
      queryOne(`SELECT * FROM customers WHERE id=?`, [customerId]),
      queryAll(`SELECT cl.*, u.name AS created_by_name FROM customer_ledger cl LEFT JOIN users u ON cl.created_by=u.id WHERE cl.customer_id=? ORDER BY cl.entry_date ASC`, [customerId]),
      queryOne(`
        SELECT COALESCE(SUM(so.total_amount),0) AS total_invoiced,
          COALESCE(SUM(so.amount_paid),0) AS total_paid,
          COUNT(so.id) AS total_orders,
          COUNT(CASE WHEN so.payment_status='UNPAID' THEN 1 END) AS unpaid_count,
          COALESCE(SUM(CASE WHEN so.payment_status!='PAID' THEN so.total_amount-so.amount_paid ELSE 0 END),0) AS outstanding
        FROM sales_orders so WHERE so.customer_id=?
      `, [customerId]),
      queryAll(`SELECT id, order_number, created_at, total_amount, amount_paid, payment_status, type, payment_method FROM sales_orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 50`, [customerId]),
      queryAll(`SELECT return_number, return_date, total_refund, reason FROM sales_returns WHERE customer_id=? ORDER BY return_date DESC`, [customerId]),
    ]);

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    return NextResponse.json({ customer, ledger, summary, orders, returns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const customerId = parseInt(params.id);
    const { type, referenceNumber, description, debit, credit } = await req.json();

    const lastBal = await queryOne(`SELECT balance FROM customer_ledger WHERE customer_id=? ORDER BY entry_date DESC LIMIT 1`, [customerId]);
    const newBal = Number(lastBal?.balance || 0) + Number(debit || 0) - Number(credit || 0);

    const db = getDB();
    await db.batch([
      db.prepare(`INSERT INTO customer_ledger (customer_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(customerId, type, referenceNumber || null, description || '', debit || 0, credit || 0, newBal, session.id),
      db.prepare(`UPDATE customers SET current_balance=? WHERE id=?`).bind(newBal, customerId),
    ]);
    return NextResponse.json({ success: true, newBalance: newBal });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
