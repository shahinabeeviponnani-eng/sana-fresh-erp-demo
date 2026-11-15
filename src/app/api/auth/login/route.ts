export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { ROLE_DEFAULT_PERMISSIONS } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  try {
    const { email, password, pin } = await req.json();
    let user: any = null;

    if (pin) {
      user = await queryOne(
        `SELECT id, email, name, role, status, pin_code, permissions FROM users WHERE pin_code = ? AND status = 'ACTIVE' LIMIT 1`,
        [pin]
      );
      if (!user) return NextResponse.json({ error: 'Invalid PIN code' }, { status: 401 });
    } else if (email && password) {
      user = await queryOne(
        `SELECT id, email, name, role, status, password_hash, permissions FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
        [email.trim()]
      );
      if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'Account is suspended or inactive' }, { status: 403 });
      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    } else {
      return NextResponse.json({ error: 'Please provide email/password or PIN' }, { status: 400 });
    }

    const perms = user.permissions ? JSON.parse(user.permissions) : [];
    const effectivePermissions = Array.isArray(perms) && perms.length > 0
      ? perms : ROLE_DEFAULT_PERMISSIONS[user.role] || [];

    const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role, permissions: effectivePermissions };
    const token = await signToken(sessionUser);

    await logAuditEvent(sessionUser, pin ? 'AUTH_PIN_LOGIN' : 'AUTH_LOGIN', 'AUTH', { role: user.role });

    const response = NextResponse.json({ success: true, token, user: sessionUser });
    response.cookies.set('erp_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
