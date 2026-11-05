import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    let sql = `
      SELECT 
        v.*,
        COUNT(po.id) AS total_po_count,
        COALESCE(SUM(po.total_amount), 0) AS total_po_value
      FROM vendors v
      LEFT JOIN purchase_orders po ON po.vendor_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (v.name ILIKE $${params.length} OR v.company_name ILIKE $${params.length} OR v.contact_person ILIKE $${params.length} OR v.email ILIKE $${params.length})`;
    }

    sql += ` GROUP BY v.id ORDER BY v.id ASC`;

    const res = await query(sql, params);
    return NextResponse.json({ vendors: res.rows });
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
      contact_person,
      email,
      phone,
      tax_id,
      address,
      payment_terms = 'NET_30',
      bank_details,
      notes,
    } = body;

    if (!name || !company_name) {
      return NextResponse.json({ error: 'Vendor name and Company name are required' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO vendors (
        name, company_name, contact_person, email, phone, tax_id,
        address, payment_terms, bank_details, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        name.trim(),
        company_name.trim(),
        contact_person || null,
        email || null,
        phone || null,
        tax_id || null,
        address || null,
        payment_terms,
        bank_details || null,
        notes || '',
      ]
    );

    const vendor = res.rows[0];

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Staff',
      action: 'VENDOR_CREATED',
      module: 'VENDORS',
      details: { name: vendor.name, company: vendor.company_name },
    });

    return NextResponse.json({ vendor, success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
