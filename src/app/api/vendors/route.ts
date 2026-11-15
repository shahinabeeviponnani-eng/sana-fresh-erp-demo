export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, insertReturningId } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'view_vendors'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const search = new URL(req.url).searchParams.get('search');
    let sql = `
      SELECT v.*, COUNT(po.id) AS total_po_count, COALESCE(SUM(po.total_amount), 0) AS total_po_value
      FROM vendors v LEFT JOIN purchase_orders po ON po.vendor_id = v.id WHERE 1=1
    `;
    const params: any[] = [];
    if (search) {
      sql += ` AND (v.name LIKE ? OR v.company_name LIKE ? OR v.contact_person LIKE ? OR v.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` GROUP BY v.id ORDER BY v.id ASC`;

    const vendors = await queryAll(sql, params);
    return NextResponse.json({ vendors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    const { name, company_name, contact_person, email, phone, tax_id, address,
      payment_terms = 'NET_30', bank_details, notes } = await req.json();

    if (!name || !company_name)
      return NextResponse.json({ error: 'Vendor name and Company name are required' }, { status: 400 });

    const id = await insertReturningId(
      `INSERT INTO vendors (name, company_name, contact_person, email, phone, tax_id, address, payment_terms, bank_details, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), company_name.trim(), contact_person || null, email || null, phone || null,
       tax_id || null, address || null, payment_terms, bank_details || null, notes || '']
    );
    const vendor = await queryOne(`SELECT * FROM vendors WHERE id = ?`, [id]);
    await logAuditEvent(session, 'VENDOR_CREATED', 'VENDORS', { name, company_name });
    return NextResponse.json({ vendor, success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
