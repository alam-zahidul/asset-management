import { query, getClient } from '../config/database';
import { fieldService } from './field.service';
import { authService } from './auth.service';
import { sanitizeObject } from '../utils/sanitize';
import { logger } from '../utils/logger';

interface AssetListParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
  status?: string;
  fields?: Record<string, string>;
}

interface AssetListResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AssetService {
  async list(params: AssetListParams): Promise<AssetListResult> {
    const { page, limit, sortBy, sortOrder, search, status, fields } = params;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND a.status = $${paramIndex++}`;
      queryParams.push(status);
    }

    if (search) {
      whereClause += ` AND (a.asset_tag ILIKE $${paramIndex} OR a.data::text ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Dynamic field filters using JSONB
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        // Validate field key exists
        const fieldDef = await fieldService.getFieldByKey(key);
        if (!fieldDef || !fieldDef.is_filterable) continue;

        whereClause += ` AND a.data->>$${paramIndex} ILIKE $${paramIndex + 1}`;
        queryParams.push(key, `%${value}%`);
        paramIndex += 2;
      }
    }

    // Build sort clause
    let orderClause = 'ORDER BY a.created_at DESC';
    if (sortBy) {
      const validSortFields = ['asset_tag', 'status', 'created_at', 'updated_at'];
      if (validSortFields.includes(sortBy)) {
        orderClause = `ORDER BY a.${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
      } else {
        // Sort by JSONB field
        const fieldDef = await fieldService.getFieldByKey(sortBy);
        if (fieldDef?.is_sortable) {
          orderClause = `ORDER BY a.data->>'${sortBy}' ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
        }
      }
    }

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) as total FROM inventory.assets a ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Fetch data
    const dataResult = await query(
      `SELECT a.*, u1.display_name as created_by_name, u2.display_name as updated_by_name
       FROM inventory.assets a
       LEFT JOIN auth.users u1 ON u1.id = a.created_by
       LEFT JOIN auth.users u2 ON u2.id = a.updated_by
       ${whereClause}
       ${orderClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    return {
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const result = await query(
      `SELECT a.*, u1.display_name as created_by_name, u2.display_name as updated_by_name
       FROM inventory.assets a
       LEFT JOIN auth.users u1 ON u1.id = a.created_by
       LEFT JOIN auth.users u2 ON u2.id = a.updated_by
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data: { asset_tag?: string; data: Record<string, unknown>; status: string }, userId: string, ip: string, userAgent: string) {
    // Sanitize data
    const sanitizedData = sanitizeObject(data.data);

    // Validate against field definitions
    const validation = await fieldService.validateAssetData(sanitizedData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    // Check unique constraints
    await this.checkUniqueConstraints(sanitizedData, null);

    const result = await query(
      `INSERT INTO inventory.assets (asset_tag, data, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING *`,
      [data.asset_tag || null, JSON.stringify(sanitizedData), data.status, userId]
    );

    const asset = result.rows[0];

    // Record history
    await query(
      `INSERT INTO inventory.asset_history (asset_id, changed_by, change_type, new_data)
       VALUES ($1, $2, 'create', $3)`,
      [asset.id, userId, JSON.stringify(sanitizedData)]
    );

    await authService.auditLog(userId, 'asset.create', 'asset', asset.id, { asset_tag: data.asset_tag }, ip, userAgent);

    return asset;
  }

  async update(id: string, data: { asset_tag?: string; data?: Record<string, unknown>; status?: string }, userId: string, ip: string, userAgent: string) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Asset not found');

    const updatedData = data.data ? sanitizeObject({ ...existing.data, ...data.data }) : existing.data;

    if (data.data) {
      const validation = await fieldService.validateAssetData(updatedData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
      }
      await this.checkUniqueConstraints(updatedData, id);
    }

    const changedFields = data.data
      ? Object.keys(data.data).filter((k) => JSON.stringify(existing.data[k]) !== JSON.stringify(updatedData[k]))
      : [];

    const result = await query(
      `UPDATE inventory.assets SET
        asset_tag = COALESCE($1, asset_tag),
        data = $2,
        status = COALESCE($3, status),
        updated_by = $4,
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [data.asset_tag, JSON.stringify(updatedData), data.status, userId, id]
    );

    // Record history
    await query(
      `INSERT INTO inventory.asset_history (asset_id, changed_by, change_type, previous_data, new_data, changed_fields)
       VALUES ($1, $2, 'update', $3, $4, $5)`,
      [id, userId, JSON.stringify(existing.data), JSON.stringify(updatedData), changedFields]
    );

    await authService.auditLog(userId, 'asset.update', 'asset', id, { changed_fields: changedFields }, ip, userAgent);

    return result.rows[0];
  }

  async delete(id: string, userId: string, ip: string, userAgent: string) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Asset not found');

    await query(
      `INSERT INTO inventory.asset_history (asset_id, changed_by, change_type, previous_data)
       VALUES ($1, $2, 'delete', $3)`,
      [id, userId, JSON.stringify(existing.data)]
    );

    await query('DELETE FROM inventory.assets WHERE id = $1', [id]);

    await authService.auditLog(userId, 'asset.delete', 'asset', id, { asset_tag: existing.asset_tag }, ip, userAgent);
  }

  async getHistory(assetId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const result = await query(
      `SELECT ah.*, u.display_name as changed_by_name
       FROM inventory.asset_history ah
       LEFT JOIN auth.users u ON u.id = ah.changed_by
       WHERE ah.asset_id = $1
       ORDER BY ah.created_at DESC
       LIMIT $2 OFFSET $3`,
      [assetId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM inventory.asset_history WHERE asset_id = $1',
      [assetId]
    );

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  private async checkUniqueConstraints(data: Record<string, unknown>, excludeAssetId: string | null) {
    const fields = await fieldService.getActiveFields();
    const uniqueFields = fields.filter((f) => f.is_unique);

    for (const field of uniqueFields) {
      const value = data[field.field_key];
      if (!value) continue;

      let uniqueQuery = `SELECT id FROM inventory.assets WHERE data->>$1 = $2`;
      const params: unknown[] = [field.field_key, String(value)];

      if (excludeAssetId) {
        uniqueQuery += ` AND id != $3`;
        params.push(excludeAssetId);
      }

      const result = await query(uniqueQuery, params);
      if (result.rows.length > 0) {
        throw new Error(`${field.display_name} must be unique. Value '${value}' already exists.`);
      }
    }
  }
}

export const assetService = new AssetService();
