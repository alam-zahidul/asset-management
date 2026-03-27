import { Request, Response } from 'express';
import db from '../config/database';
import { createAuditLog } from '../services/auditService';
import { NotFoundError } from '../utils/errors';

export async function list(req: Request, res: Response): Promise<void> {
  const templates = await db('admin.export_templates')
    .join('auth.users', 'auth.users.id', 'admin.export_templates.created_by')
    .select('admin.export_templates.*', 'auth.users.username', 'auth.users.display_name')
    .orderBy('admin.export_templates.updated_at', 'desc');

  res.json({ status: 'success', data: templates });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const template = await db('admin.export_templates').where('id', req.params.id).first();
  if (!template) throw new NotFoundError('Template not found');
  res.json({ status: 'success', data: template });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { name, field_ids, filters, format } = req.body;

  const [template] = await db('admin.export_templates')
    .insert({
      name,
      field_ids: JSON.stringify(field_ids),
      filters: filters ? JSON.stringify(filters) : null,
      format: format || 'xlsx',
      created_by: req.user!.userId,
    })
    .returning('*');

  await createAuditLog({
    userId: req.user!.userId,
    action: 'create',
    resource: 'export_template',
    resourceId: template.id,
    newValues: { name, format },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({ status: 'success', data: template });
}

export async function update(req: Request, res: Response): Promise<void> {
  const existing = await db('admin.export_templates').where('id', req.params.id).first();
  if (!existing) throw new NotFoundError('Template not found');

  const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
  if (req.body.name) updateData.name = req.body.name;
  if (req.body.field_ids) updateData.field_ids = JSON.stringify(req.body.field_ids);
  if (req.body.filters !== undefined) updateData.filters = req.body.filters ? JSON.stringify(req.body.filters) : null;
  if (req.body.format) updateData.format = req.body.format;

  const [template] = await db('admin.export_templates')
    .where('id', req.params.id)
    .update(updateData)
    .returning('*');

  res.json({ status: 'success', data: template });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const deleted = await db('admin.export_templates').where('id', req.params.id).delete();
  if (!deleted) throw new NotFoundError('Template not found');

  await createAuditLog({
    userId: req.user!.userId,
    action: 'delete',
    resource: 'export_template',
    resourceId: req.params.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ status: 'success', message: 'Template deleted' });
}
