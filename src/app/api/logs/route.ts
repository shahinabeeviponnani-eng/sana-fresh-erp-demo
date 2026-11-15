export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!checkUserPermission(session.role, session.permissions, 'view_logs'))
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const module = searchParams.get('module');
    const severity = searchParams.get('severity');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;

    let where = `WHERE 1=1`;
    const params: any[] = [];
    if (module && module !== 'ALL') { where += ` AND module=?`; params.push(module.toUpperCase()); }
    if (severity && severity !== 'ALL') { where += ` AND severity=?`; params.push(severity.toUpperCase()); }
    if (search) { where += ` AND (action LIKE ? OR staff_name LIKE ? OR details LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const countRow = await queryOne(`SELECT COUNT(*) AS cnt FROM audit_logs ${where}`, params);
    const total = Number(countRow?.cnt || 0);

    const logs = await queryAll(
      `SELECT id, staff_id, staff_name, action, module, severity, details, ip_address, created_at FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const parsed = logs.map(l => ({ ...l, details: l.details ? (() => { try { return JSON.parse(l.details); } catch { return l.details; } })() : null }));
    return NextResponse.json({ logs: parsed, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
