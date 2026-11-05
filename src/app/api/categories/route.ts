import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET() {
  try {
    const res = await query(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    return NextResponse.json({ categories: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const { name, code, description } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO categories (name, code, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), code.toUpperCase().trim(), description || '']
    );

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Admin',
      action: 'CATEGORY_CREATED',
      module: 'INVENTORY',
      details: { name, code },
    });

    return NextResponse.json({ category: res.rows[0], success: true }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A category with this code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
