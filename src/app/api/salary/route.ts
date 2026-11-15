export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getUserFromRequest(req);
  if (!session || !checkUserPermission(session.role, session.permissions, 'view_reports'))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get('staffId');
  const period = searchParams.get('period');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  const offset = (page - 1) * limit;

  let where = `WHERE 1=1`;
  const params: any[] = [];
  if (staffId) { where += ` AND sr.staff_id=?`; params.push(staffId); }
  if (period) { where += ` AND sr.pay_period_start>=? AND sr.pay_period_start<=?`; params.push(`${period}-01`, `${period}-31`); }

  const countRow = await queryOne(`SELECT COUNT(*) AS cnt FROM salary_records sr ${where}`, params);
  const total = Number(countRow?.cnt || 0);

  const [records, staff, summary] = await Promise.all([
    queryAll(`SELECT sr.*, u.email FROM salary_records sr LEFT JOIN users u ON sr.staff_id=u.id ${where} ORDER BY sr.pay_period_start DESC, sr.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
    queryAll(`SELECT id, name, role, email FROM users WHERE status='ACTIVE' ORDER BY name`),
    queryOne(`SELECT COUNT(*) AS total_records, COALESCE(SUM(net_pay),0) AS total_paid, COALESCE(SUM(CASE WHEN payment_status='PENDING' THEN net_pay ELSE 0 END),0) AS total_pending, COALESCE(SUM(bonus),0) AS total_bonus, COALESCE(SUM(deductions),0) AS total_deductions FROM salary_records`),
  ]);

  return NextResponse.json({ records, staff, summary, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getUserFromRequest(req);
  if (!session || !checkUserPermission(session.role, session.permissions, 'manage_staff'))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { staffId, payPeriodStart, payPeriodEnd, basicSalary, bonus = 0, deductions = 0, paymentMethod = 'BANK_TRANSFER', notes } = await req.json();
  if (!staffId || !payPeriodStart || !payPeriodEnd || basicSalary == null)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const staff = await queryOne(`SELECT name, role FROM users WHERE id=?`, [staffId]);
  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });

  const netPay = Number(basicSalary) + Number(bonus) - Number(deductions);
  const id = await insertReturningId(
    `INSERT INTO salary_records (staff_id, staff_name, role, pay_period_start, pay_period_end, basic_salary, bonus, deductions, net_pay, payment_method, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [staffId, staff.name, staff.role, payPeriodStart, payPeriodEnd, basicSalary, bonus, deductions, netPay, paymentMethod, notes || null, session.id]
  );
  const record = await queryOne(`SELECT * FROM salary_records WHERE id=?`, [id]);
  return NextResponse.json({ record }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getUserFromRequest(req);
  if (!session || !checkUserPermission(session.role, session.permissions, 'manage_staff'))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { recordId } = await req.json();
  if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 });

  await execute(`UPDATE salary_records SET payment_status='PAID', paid_at=datetime('now') WHERE id=?`, [recordId]);
  const record = await queryOne(`SELECT * FROM salary_records WHERE id=?`, [recordId]);
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  return NextResponse.json({ record });
}

export async function DELETE(req: NextRequest) {
  const session = await getUserFromRequest(req);
  if (!session || !checkUserPermission(session.role, session.permissions, 'manage_staff'))
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await execute(`DELETE FROM salary_records WHERE id=?`, [id]);
  return NextResponse.json({ success: true });
}
