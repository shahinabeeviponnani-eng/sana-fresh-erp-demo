import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const module = searchParams.get('module');
    const severity = searchParams.get('severity');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    let sql = `
      SELECT id, staff_id, staff_name, action, module, severity, details, ip_address, created_at
      FROM audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];

    if (module && module !== 'ALL') {
      params.push(module.toUpperCase());
      sql += ` AND module = $${params.length}`;
    }

    if (severity && severity !== 'ALL') {
      params.push(severity.toUpperCase());
      sql += ` AND severity = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (action ILIKE $${params.length} OR staff_name ILIKE $${params.length} OR details::text ILIKE $${params.length})`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const res = await query(sql, params);
    return NextResponse.json({ logs: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
