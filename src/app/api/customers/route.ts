export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const canView =
      checkUserPermission(session.role, session.permissions, 'view_customers') ||
      (type?.toUpperCase() === 'RETAIL' && checkUserPermission(session.role, session.permissions, 'access_pos'));
    if (!canView)
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    let sql = `
      SELECT c.*, COUNT(so.id) AS total_orders_count, COALESCE(SUM(so.total_amount), 0) AS total_spent
      FROM customers c LEFT JOIN sales_orders so ON so.customer_id = c.id WHERE 1=1
    `;
    const params: any[] = [];

    if (type) { sql += ` AND c.type = ?`; params.push(type.toUpperCase()); }
    if (search) {
      sql += ` AND (c.name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` GROUP BY c.id ORDER BY c.id ASC`;

    const customers = await queryAll(sql, params);
    return NextResponse.json({ customers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const canCreate =
      checkUserPermission(session.role, session.permissions, 'manage_customers') ||
      checkUserPermission(session.role, session.permissions, 'access_pos') ||
      checkUserPermission(session.role, session.permissions, 'create_invoices');
    if (!canCreate) {
      return NextResponse.json({ error: 'Access Denied: Permission required to create customers' }, { status: 403 });
    }

    const { name, company_name, type = 'RETAIL', email, phone, tax_id, address, city,
      postal_code, country = 'United Kingdom', credit_limit = 0, payment_terms = 'Due on Receipt',
      discount_percent = 0, notes } = await req.json();

    if (!name) return NextResponse.json({ error: 'Customer Name is required' }, { status: 400 });

    const id = await insertReturningId(
      `INSERT INTO customers (name, company_name, type, email, phone, tax_id, address, city,
        postal_code, country, credit_limit, payment_terms, discount_percent, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), company_name || null, type.toUpperCase(), email || null, phone || null,
       tax_id || null, address || null, city || null, postal_code || null,
       country || 'United Kingdom', Number(credit_limit) || 0, payment_terms,
       Number(discount_percent) || 0, notes || '']
    );
    const customer = await queryOne(`SELECT * FROM customers WHERE id = ?`, [id]);
    await logAuditEvent(session, 'CUSTOMER_CREATED', 'CUSTOMERS', { name, type });
    return NextResponse.json({ customer, success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const canEdit =
      checkUserPermission(session.role, session.permissions, 'manage_customers') ||
      checkUserPermission(session.role, session.permissions, 'access_pos') ||
      checkUserPermission(session.role, session.permissions, 'create_invoices');
    if (!canEdit) {
      return NextResponse.json({ error: 'Access Denied: Permission required to edit customers' }, { status: 403 });
    }

    const { id, name, company_name, type, email, phone, tax_id, address, city,
      credit_limit, current_balance, payment_terms, discount_percent, notes } = await req.json();

    if (!id) return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });

    await execute(
      `UPDATE customers SET name=?, company_name=?, type=?, email=?, phone=?, tax_id=?,
       address=?, city=?, credit_limit=?, current_balance=?, payment_terms=?,
       discount_percent=?, notes=? WHERE id=?`,
      [name.trim(), company_name || null, type.toUpperCase(), email || null, phone || null,
       tax_id || null, address || null, city || null, Number(credit_limit) || 0,
       Number(current_balance) || 0, payment_terms, Number(discount_percent) || 0, notes || '', id]
    );
    const customer = await queryOne(`SELECT * FROM customers WHERE id = ?`, [id]);
    await logAuditEvent(session, 'CUSTOMER_UPDATED', 'CUSTOMERS', { id, name });
    return NextResponse.json({ customer, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
