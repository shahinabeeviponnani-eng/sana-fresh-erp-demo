import { query } from './db';

export interface AuditLogOptions {
  staffId?: number | null;
  staffName?: string | null;
  action: string;
  module: 'AUTH' | 'RETAIL' | 'WHOLESALE' | 'INVENTORY' | 'CUSTOMERS' | 'VENDORS' | 'STAFF' | 'SETTINGS' | 'REPORTS';
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAuditEvent({
  staffId = null,
  staffName = 'System',
  action,
  module,
  severity = 'INFO',
  details = {},
  ipAddress = '127.0.0.1',
}: AuditLogOptions): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (staff_id, staff_name, action, module, severity, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [staffId, staffName, action, module, severity, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
