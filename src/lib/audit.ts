import { execute } from './db';
import { UserSession } from './auth';

export async function logAuditEvent(
  session: UserSession | null,
  action: string,
  module: string,
  details: object,
  severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'
): Promise<void> {
  try {
    await execute(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, '127.0.0.1')`,
      [session?.id ?? null, session?.name ?? 'System', action, module, severity, JSON.stringify(details)]
    );
  } catch {
    // Non-fatal
  }
}
