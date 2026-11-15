export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { ROLE_DEFAULT_PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ authenticated: false, user: null }, { status: 401 });

    const dbUser = await queryOne(
      `SELECT id, email, name, role, phone, pin_code, status, permissions FROM users WHERE id = ?`,
      [session.id]
    );
    if (!dbUser || dbUser.status !== 'ACTIVE') return NextResponse.json({ authenticated: false, user: null }, { status: 401 });

    const perms = dbUser.permissions ? JSON.parse(dbUser.permissions) : [];
    const effectivePermissions = Array.isArray(perms) && perms.length > 0
      ? perms : ROLE_DEFAULT_PERMISSIONS[dbUser.role] || [];

    return NextResponse.json({
      authenticated: true,
      user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, phone: dbUser.phone, status: dbUser.status, permissions: effectivePermissions },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete('erp_token');
  return response;
}
