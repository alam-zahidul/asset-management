import { Request, Response } from 'express';
import * as fieldService from '../services/fieldService';
import { createAuditLog } from '../services/auditService';

export async function list(_req: Request, res: Response): Promise<void> {
  const fields = await fieldService.getAllFields();
  res.json({ status: 'success', data: fields });
}

export async function getActive(_req: Request, res: Response): Promise<void> {
  const fields = await fieldService.getActiveFields();
  res.json({ status: 'success', data: fields });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const field = await fieldService.getFieldById(req.params.id);
  res.json({ status: 'success', data: field });
}

export async function create(req: Request, res: Response): Promise<void> {
  const field = await fieldService.createField(req.body, req.user!.userId);

  await createAuditLog({
    userId: req.user!.userId,
    action: 'create',
    resource: 'field',
    resourceId: field.id,
    newValues: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({ status: 'success', data: field });
}

export async function update(req: Request, res: Response): Promise<void> {
  const oldField = await fieldService.getFieldById(req.params.id);
  const field = await fieldService.updateField(req.params.id, req.body, req.user!.userId);

  await createAuditLog({
    userId: req.user!.userId,
    action: 'update',
    resource: 'field',
    resourceId: req.params.id,
    oldValues: oldField as unknown as Record<string, unknown>,
    newValues: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ status: 'success', data: field });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await fieldService.deleteField(req.params.id);

  await createAuditLog({
    userId: req.user!.userId,
    action: 'delete',
    resource: 'field',
    resourceId: req.params.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ status: 'success', message: 'Field deleted' });
}
