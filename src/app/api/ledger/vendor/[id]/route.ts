export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, getDB } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const vendorId = parseInt(params.id);

    const [vendor, ledger, summary, purchaseOrders, returns] = await Promise.all([
      queryOne(`SELECT * FROM vendors WHERE id=?`, [vendorId]),
      queryAll(`SELECT vl.*, u.name AS created_by_name FROM vendor_ledger vl LEFT JOIN users u ON vl.created_by=u.id WHERE vl.vendor_id=? ORDER BY vl.entry_date ASC`, [vendorId]),
      queryOne(`
        SELECT COALESCE(SUM(po.total_amount),0) AS total_purchased,
          COUNT(po.id) AS total_pos,
          COUNT(CASE WHEN po.payment_status='UNPAID' THEN 1 END) AS unpaid_count,
          COALESCE(SUM(CASE WHEN po.payment_status='UNPAID' THEN po.total_amount ELSE 0 END),0) AS outstanding
        FROM purchase_orders po WHERE po.vendor_id=?
      `, [vendorId]),
      queryAll(`SELECT id, po_number, created_at, total_amount, payment_status, status, received_at FROM purchase_orders WHERE vendor_id=? ORDER BY created_at DESC LIMIT 50`, [vendorId]),
      queryAll(`SELECT return_number, return_date, total_credit, reason FROM purchase_returns WHERE vendor_id=? ORDER BY return_date DESC`, [vendorId]),
    ]);

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    return NextResponse.json({ vendor, ledger, summary, purchaseOrders, returns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const vendorId = parseInt(params.id);
    const { type, referenceNumber, description, debit, credit } = await req.json();

    const lastBal = await queryOne(`SELECT balance FROM vendor_ledger WHERE vendor_id=? ORDER BY entry_date DESC LIMIT 1`, [vendorId]);
    const newBal = Number(lastBal?.balance || 0) + Number(debit || 0) - Number(credit || 0);

    const db = getDB();
    await db.batch([
      db.prepare(`INSERT INTO vendor_ledger (vendor_id, type, reference_number, description, debit, credit, balance, created_by) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(vendorId, type, referenceNumber || null, description || '', debit || 0, credit || 0, newBal, session.id),
    ]);
    return NextResponse.json({ success: true, newBalance: newBal });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
