import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET() {
  try {
    const res = await query(`
      SELECT id, email, name, role, phone, pin_code, status, created_at, updated_at
      FROM users
      ORDER BY id ASC;
    `);
    return NextResponse.json({ staff: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const { email, name, password, pin_code, role = 'CASHIER', phone } = body;

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Email, Name, and Password are required' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const res = await query(
      `INSERT INTO users (email, name, password_hash, pin_code, role, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
       RETURNING id, email, name, role, phone, pin_code, status, created_at`,
      [email.toLowerCase().trim(), name.trim(), passwordHash, pin_code || null, role, phone || null]
    );

    const newUser = res.rows[0];

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Admin',
      action: 'STAFF_MEMBER_CREATED',
      module: 'STAFF',
      details: { email: newUser.email, name: newUser.name, role: newUser.role },
    });

    return NextResponse.json({ staff: newUser, success: true }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    const body = await req.json();
    const { id, name, role, phone, pin_code, status, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [id];

    if (name) {
      params.push(name.trim());
      updates.push(`name = $${params.length}`);
    }
    if (role) {
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (phone !== undefined) {
      params.push(phone);
      updates.push(`phone = $${params.length}`);
    }
    if (pin_code !== undefined) {
      params.push(pin_code);
      updates.push(`pin_code = $${params.length}`);
    }
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (password) {
      const passwordHash = await hashPassword(password);
      params.push(passwordHash);
      updates.push(`password_hash = $${params.length}`);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const res = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING id, email, name, role, phone, pin_code, status, updated_at`,
      params
    );

    await logAuditEvent({
      staffId: session?.id,
      staffName: session?.name || 'Admin',
      action: 'STAFF_MEMBER_UPDATED',
      module: 'STAFF',
      details: { userId: id, updates: { role, status, name } },
    });

    return NextResponse.json({ staff: res.rows[0], success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
