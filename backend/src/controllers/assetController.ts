import { Request, Response } from 'express';
import * as assetService from '../services/assetService';
import { parseUploadedFile } from '../services/importService';
import { exportAssets } from '../services/exportService';
import { createAuditLog } from '../services/auditService';
import db from '../config/database';

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, search, sortBy, sortOrder, ...rest } = req.query as Record<string, string>;

  const filters: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (key.startsWith('filter_')) {
      filters[key.substring(7)] = value;
    }
  }

  const result = await assetService.getAssets({
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 25,
    search: search as string,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    sortBy: sortBy as string,
    sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
  });

  res.json({ status: 'success', data: result });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const asset = await assetService.getAssetById(req.params.id);
  res.json({ status: 'success', data: asset });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { asset_tag, field_values } = req.body;
  const asset = await assetService.createAsset(asset_tag, field_values, req.user!.userId);

  await createAuditLog({
    userId: req.user!.userId,
    action: 'create',
    resource: 'asset',
    resourceId: (asset as { id: string }).id,
    newValues: { asset_tag, field_values },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({ status: 'success', data: asset });
}

export async function update(req: Request, res: Response): Promise<void> {
  const oldAsset = await assetService.getAssetById(req.params.id);
  const { field_values } = req.body;
  const asset = await assetService.updateAsset(req.params.id, field_values, req.user!.userId);

  await createAuditLog({
    userId: req.user!.userId,
    action: 'update',
    resource: 'asset',
    resourceId: req.params.id,
    oldValues: (oldAsset as { field_values: Record<string, unknown> }).field_values,
    newValues: field_values,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ status: 'success', data: asset });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await assetService.deleteAsset(req.params.id);

  await createAuditLog({
    userId: req.user!.userId,
    action: 'delete',
    resource: 'asset',
    resourceId: req.params.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ status: 'success', message: 'Asset deleted' });
}

export async function importFile(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ status: 'error', message: 'No file uploaded' });
    return;
  }

  // Create import log
  const [importLog] = await db('app.import_logs')
    .insert({
      user_id: req.user!.userId,
      file_name: req.file.originalname,
      file_type: req.file.originalname.split('.').pop() || 'unknown',
      status: 'processing',
    })
    .returning('*');

  try {
    const records = await parseUploadedFile(req.file.path, req.file.mimetype);
    const result = await assetService.bulkUpsertAssets(records, req.user!.userId);

    await db('app.import_logs').where('id', importLog.id).update({
      total_rows: records.length,
      success_rows: result.success,
      error_rows: result.errors.length,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      status: result.errors.length === records.length ? 'failed' : 'completed',
      completed_at: db.fn.now(),
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: 'import',
      resource: 'asset',
      resourceId: importLog.id,
      newValues: {
        fileName: req.file.originalname,
        totalRows: records.length,
        successRows: result.success,
        errorRows: result.errors.length,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      status: 'success',
      data: {
        importId: importLog.id,
        totalRows: records.length,
        successRows: result.success,
        errorRows: result.errors.length,
        errors: result.errors.slice(0, 50), // Limit error details in response
      },
    });
  } catch (err) {
    await db('app.import_logs').where('id', importLog.id).update({
      status: 'failed',
      errors: JSON.stringify([{ message: (err as Error).message }]),
      completed_at: db.fn.now(),
    });
    throw err;
  }
}

export async function exportData(req: Request, res: Response): Promise<void> {
  const { format, fieldIds, filters, search } = req.body;

  const result = await exportAssets({
    format: format || 'xlsx',
    fieldIds,
    filters,
    search,
  });

  await createAuditLog({
    userId: req.user!.userId,
    action: 'export',
    resource: 'asset',
    newValues: { format, fieldIds, filters, search },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  res.send(result.buffer);
}

export async function getFieldDistinctValues(req: Request, res: Response): Promise<void> {
  const values = await assetService.getAssetFieldValues(req.params.fieldKey);
  res.json({ status: 'success', data: values });
}

export async function getImportLogs(req: Request, res: Response): Promise<void> {
  const { page = '1', limit = '25' } = req.query as Record<string, string>;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [logs, countResult] = await Promise.all([
    db('app.import_logs')
      .join('auth.users', 'auth.users.id', 'app.import_logs.user_id')
      .select('app.import_logs.*', 'auth.users.username', 'auth.users.display_name')
      .orderBy('app.import_logs.started_at', 'desc')
      .offset(offset)
      .limit(parseInt(limit, 10)),
    db('app.import_logs').count('* as total').first(),
  ]);

  res.json({
    status: 'success',
    data: {
      data: logs,
      total: Number(countResult?.total || 0),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    },
  });
}
