import { Request, Response, NextFunction } from 'express';
import * as vmwareSyncService from '../services/vmwareSyncService';
import { createAuditLog } from '../services/auditService';
import logger from '../utils/logger';

export async function listConnections(req: Request, res: Response, next: NextFunction) {
  try {
    const connections = await vmwareSyncService.getConnections();
    res.json({ status: 'success', data: connections });
  } catch (err) {
    next(err);
  }
}

export async function getConnection(req: Request, res: Response, next: NextFunction) {
  try {
    const conn = await vmwareSyncService.getConnectionById(req.params.id);
    res.json({ status: 'success', data: conn });
  } catch (err) {
    next(err);
  }
}

export async function createConnection(req: Request, res: Response, next: NextFunction) {
  try {
    const conn = await vmwareSyncService.createConnection(req.body, (req as any).user.id);
    await createAuditLog({
      userId: (req as any).user.id,
      action: 'create',
      resource: 'vmware_connection',
      resourceId: conn.id,
      newValues: { name: conn.name, server: conn.server },
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    res.status(201).json({ status: 'success', data: conn });
  } catch (err) {
    next(err);
  }
}

export async function updateConnection(req: Request, res: Response, next: NextFunction) {
  try {
    const conn = await vmwareSyncService.updateConnection(req.params.id, req.body, (req as any).user.id);
    await createAuditLog({
      userId: (req as any).user.id,
      action: 'update',
      resource: 'vmware_connection',
      resourceId: conn.id,
      newValues: { name: conn.name, server: conn.server },
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    res.json({ status: 'success', data: conn });
  } catch (err) {
    next(err);
  }
}

export async function deleteConnection(req: Request, res: Response, next: NextFunction) {
  try {
    await vmwareSyncService.deleteConnection(req.params.id);
    await createAuditLog({
      userId: (req as any).user.id,
      action: 'delete',
      resource: 'vmware_connection',
      resourceId: req.params.id,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    res.json({ status: 'success', message: 'Connection deleted' });
  } catch (err) {
    next(err);
  }
}

export async function toggleActive(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vmwareSyncService.toggleConnectionActive(req.params.id);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function testConnection(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vmwareSyncService.testConnection(req.params.id);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function testConnectionDirect(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vmwareSyncService.testConnectionDirect(req.body);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function triggerSync(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vmwareSyncService.syncInventory(req.params.id, (req as any).user.id);
    await createAuditLog({
      userId: (req as any).user.id,
      action: 'sync',
      resource: 'vmware_connection',
      resourceId: req.params.id,
      newValues: result,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getSyncLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { connectionId, page, limit } = req.query;
    const result = await vmwareSyncService.getSyncLogs(
      connectionId as string | undefined,
      page ? Number(page) : 1,
      limit ? Number(limit) : 25
    );
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}
