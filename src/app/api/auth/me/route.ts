import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = getUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const res = await query(
      `SELECT id, email, name, role, phone, status, created_at FROM users WHERE id = $1`,
      [session.id]
    );

    if (res.rows.length === 0 || res.rows[0].status !== 'ACTIVE') {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: res.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  // Logout
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete('erp_token');
  return response;
}
