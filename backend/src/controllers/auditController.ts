import { Request, Response } from 'express';
import { getAuditLogs } from '../services/auditService';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await getAuditLogs({
    page: parseInt(req.query.page as string, 10) || 1,
    limit: parseInt(req.query.limit as string, 10) || 25,
    userId: req.query.userId as string,
    resource: req.query.resource as string,
    action: req.query.action as string,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
  });

  res.json({ status: 'success', data: result });
}
