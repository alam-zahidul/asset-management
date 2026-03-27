import db from '../config/database';
import logger from '../utils/logger';

interface AuditLogEntry {
  userId: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db('admin.audit_logs').insert({
      user_id: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId,
      old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });
  } catch (err) {
    logger.error('Failed to create audit log', err);
  }
}

export async function getAuditLogs(params: {
  page: number;
  limit: number;
  userId?: string;
  resource?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ data: unknown[]; total: number }> {
  const query = db('admin.audit_logs')
    .join('auth.users', 'auth.users.id', 'admin.audit_logs.user_id')
    .select(
      'admin.audit_logs.*',
      'auth.users.username',
      'auth.users.display_name'
    );

  if (params.userId) query.where('admin.audit_logs.user_id', params.userId);
  if (params.resource) query.where('admin.audit_logs.resource', params.resource);
  if (params.action) query.where('admin.audit_logs.action', params.action);
  if (params.startDate) query.where('admin.audit_logs.created_at', '>=', params.startDate);
  if (params.endDate) query.where('admin.audit_logs.created_at', '<=', params.endDate);

  const countQuery = query.clone().clearSelect().count('* as total').first();
  const total = ((await countQuery) as { total: string })?.total || 0;

  const data = await query
    .orderBy('admin.audit_logs.created_at', 'desc')
    .offset((params.page - 1) * params.limit)
    .limit(params.limit);

  return { data, total: Number(total) };
}
