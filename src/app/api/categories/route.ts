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

    const categories = await queryAll(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
      GROUP BY c.id ORDER BY c.name ASC
    `);
    return NextResponse.json({ categories });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'manage_products'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { name, code, description } = await req.json();
    if (!name || !code) return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 });

    const dup = await queryOne(`SELECT id FROM categories WHERE code = ?`, [code.toUpperCase().trim()]);
    if (dup) return NextResponse.json({ error: 'A category with this code already exists' }, { status: 409 });

    const id = await insertReturningId(
      `INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`,
      [name.trim(), code.toUpperCase().trim(), description || '']
    );
    const category = await queryOne(`SELECT * FROM categories WHERE id = ?`, [id]);
    await logAuditEvent(session, 'CATEGORY_CREATED', 'INVENTORY', { name, code });
    return NextResponse.json({ category, success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
