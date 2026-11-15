export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, insertReturningId } from '@/lib/db';
import { hashPassword, getUserFromRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { checkUserPermission, ROLE_DEFAULT_PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (session && !checkUserPermission(session.role, session.permissions, 'manage_staff'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const rows = await queryAll(`SELECT id, email, name, role, phone, pin_code, status, permissions, created_at FROM users ORDER BY id ASC`);
    const staff = rows.map(u => ({
      ...u,
      permissions: (() => { try { const p = JSON.parse(u.permissions || '[]'); return Array.isArray(p) && p.length > 0 ? p : ROLE_DEFAULT_PERMISSIONS[u.role] || []; } catch { return ROLE_DEFAULT_PERMISSIONS[u.role] || []; } })(),
    }));
    return NextResponse.json({ staff });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (session && !checkUserPermission(session.role, session.permissions, 'manage_staff'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { email, name, password, pin_code, role = 'CASHIER', phone, permissions } = await req.json();
    if (!email || !name || !password) return NextResponse.json({ error: 'Email, Name and Password are required' }, { status: 400 });

    const dup = await queryOne(`SELECT id FROM users WHERE LOWER(email)=LOWER(?)`, [email.trim()]);
    if (dup) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const assignedPermissions = Array.isArray(permissions) && permissions.length > 0 ? permissions : ROLE_DEFAULT_PERMISSIONS[role] || [];

    const id = await insertReturningId(
      `INSERT INTO users (email, name, password_hash, pin_code, role, phone, status, permissions) VALUES (?,?,?,?,?,?,'ACTIVE',?)`,
      [email.toLowerCase().trim(), name.trim(), passwordHash, pin_code || null, role, phone || null, JSON.stringify(assignedPermissions)]
    );
    const newUser = await queryOne(`SELECT id, email, name, role, phone, pin_code, status, created_at FROM users WHERE id=?`, [id]);
    await logAuditEvent(session, 'STAFF_MEMBER_CREATED', 'STAFF', { email, name, role });
    return NextResponse.json({ staff: newUser, success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (session && !checkUserPermission(session.role, session.permissions, 'manage_staff'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { id, name, role, phone, pin_code, status, password, permissions } = await req.json();
    if (!id) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

    const sets: string[] = [];
    const params: any[] = [];
    if (name) { sets.push(`name=?`); params.push(name.trim()); }
    if (role) { sets.push(`role=?`); params.push(role); }
    if (phone !== undefined) { sets.push(`phone=?`); params.push(phone); }
    if (pin_code !== undefined) { sets.push(`pin_code=?`); params.push(pin_code); }
    if (status) { sets.push(`status=?`); params.push(status); }
    if (permissions !== undefined) { sets.push(`permissions=?`); params.push(JSON.stringify(permissions)); }
    if (password) { sets.push(`password_hash=?`); params.push(await hashPassword(password)); }
    sets.push(`updated_at=datetime('now')`);
    params.push(id);

    await execute(`UPDATE users SET ${sets.join(',')} WHERE id=?`, params);
    const updated = await queryOne(`SELECT id, email, name, role, phone, pin_code, status, permissions FROM users WHERE id=?`, [id]);
    await logAuditEvent(session, 'STAFF_MEMBER_UPDATED', 'STAFF', { userId: id });
    return NextResponse.json({ staff: updated, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
