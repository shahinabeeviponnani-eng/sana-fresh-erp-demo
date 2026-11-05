import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, pin } = body;

    let user: any = null;

    if (pin) {
      // PIN-based fast login (ideal for POS counter cashiers on mobile/tablet)
      const res = await query(
        `SELECT id, email, name, role, status, pin_code FROM users WHERE pin_code = $1 AND status = 'ACTIVE' LIMIT 1`,
        [pin]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid PIN code' }, { status: 401 });
      }
      user = res.rows[0];
    } else if (email && password) {
      // Email and password login
      const res = await query(
        `SELECT id, email, name, role, status, password_hash FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
      user = res.rows[0];

      if (user.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Account is suspended or inactive' }, { status: 403 });
      }

      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'Please provide email/password or PIN' }, { status: 400 });
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = signToken(sessionUser);

    await logAuditEvent({
      staffId: user.id,
      staffName: user.name,
      action: pin ? 'AUTH_PIN_LOGIN' : 'AUTH_LOGIN',
      module: 'AUTH',
      severity: 'INFO',
      details: { role: user.role, loginMethod: pin ? 'PIN' : 'CREDENTIALS' },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: sessionUser,
    });

    // Set secure HTTP-only cookie
    response.cookies.set('erp_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
