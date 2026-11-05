import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    let sql = `
      SELECT 
        c.*,
        COUNT(so.id) AS total_orders_count,
        COALESCE(SUM(so.total_amount), 0) AS total_spent
      FROM customers c
      LEFT JOIN sales_orders so ON so.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type) {
      params.push(type.toUpperCase());
      sql += ` AND c.type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.name ILIKE $${params.length} OR c.company_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
    }

    sql += ` GROUP BY c.id ORDER BY c.id ASC`;

    const res = await query(sql, params);
    return NextResponse.json({ customers: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const {
      name,
      company_name,
      type = 'RETAIL',
      email,
      phone,
      tax_id,
      address,
      city,
      credit_limit = 0,
      payment_terms = 'IMMEDIATE',
      discount_percent = 0,
      notes,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Customer Name is required' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO customers (
        name, company_name, type, email, phone, tax_id,
        address, city, credit_limit, payment_terms, discount_percent, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        name.trim(),
        company_name || null,
        type.toUpperCase(),
        email || null,
        phone || null,
        tax_id || null,
        address || null,
        city || null,
        Number(credit_limit) || 0,
        payment_terms,
        Number(discount_percent) || 0,
        notes || '',
      ]
    );

    const customer = res.rows[0];

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Staff',
      action: 'CUSTOMER_CREATED',
      module: 'CUSTOMERS',
      details: { name: customer.name, type: customer.type, company: customer.company_name },
    });

    return NextResponse.json({ customer, success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const {
      id,
      name,
      company_name,
      type,
      email,
      phone,
      tax_id,
      address,
      city,
      credit_limit,
      current_balance,
      payment_terms,
      discount_percent,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const res = await query(
      `UPDATE customers
       SET name = $1, company_name = $2, type = $3, email = $4, phone = $5,
           tax_id = $6, address = $7, city = $8, credit_limit = $9, current_balance = $10,
           payment_terms = $11, discount_percent = $12, notes = $13
       WHERE id = $14
       RETURNING *`,
      [
        name.trim(),
        company_name || null,
        type.toUpperCase(),
        email || null,
        phone || null,
        tax_id || null,
        address || null,
        city || null,
        Number(credit_limit) || 0,
        Number(current_balance) || 0,
        payment_terms,
        Number(discount_percent) || 0,
        notes || '',
        id,
      ]
    );

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Staff',
      action: 'CUSTOMER_UPDATED',
      module: 'CUSTOMERS',
      details: { id, name, type },
    });

    return NextResponse.json({ customer: res.rows[0], success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
