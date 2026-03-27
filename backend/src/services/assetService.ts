import db from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { validateAssetData } from './validationService';
import { getActiveFields } from './fieldService';

export interface AssetQuery {
  page: number;
  limit: number;
  search?: string;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getAssets(query: AssetQuery): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
  const baseQuery = db('app.assets').where('app.assets.is_active', true);

  // Text search across JSONB field values
  if (query.search) {
    baseQuery.whereRaw(
      "app.assets.asset_tag ILIKE ? OR app.assets.field_values::text ILIKE ?",
      [`%${query.search}%`, `%${query.search}%`]
    );
  }

  // Dynamic field filters
  if (query.filters) {
    for (const [key, value] of Object.entries(query.filters)) {
      if (key === 'asset_tag') {
        baseQuery.where('app.assets.asset_tag', 'ILIKE', `%${value}%`);
      } else if (value !== undefined && value !== null && value !== '') {
        baseQuery.whereRaw("app.assets.field_values->>? ILIKE ?", [key, `%${value}%`]);
      }
    }
  }

  // Count total
  const countResult = await baseQuery.clone().count('* as total').first();
  const total = Number(countResult?.total || 0);

  // Sorting
  if (query.sortBy === 'asset_tag' || query.sortBy === 'created_at' || query.sortBy === 'updated_at') {
    baseQuery.orderBy(`app.assets.${query.sortBy}`, query.sortOrder || 'asc');
  } else if (query.sortBy) {
    baseQuery.orderByRaw("app.assets.field_values->>? " + (query.sortOrder === 'desc' ? 'DESC' : 'ASC'), [query.sortBy]);
  } else {
    baseQuery.orderBy('app.assets.created_at', 'desc');
  }

  const data = await baseQuery
    .offset((query.page - 1) * query.limit)
    .limit(query.limit)
    .select('app.assets.*');

  return { data, total, page: query.page, limit: query.limit };
}

export async function getAssetById(id: string): Promise<unknown> {
  const asset = await db('app.assets').where('id', id).first();
  if (!asset) throw new NotFoundError('Asset not found');
  return asset;
}

export async function createAsset(
  assetTag: string,
  fieldValues: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  if (!assetTag?.trim()) throw new BadRequestError('Asset tag is required');

  const existing = await db('app.assets').where('asset_tag', assetTag.trim()).first();
  if (existing) throw new BadRequestError('Asset tag already exists');

  const validatedValues = await validateAssetData(fieldValues);

  const [asset] = await db('app.assets')
    .insert({
      asset_tag: assetTag.trim(),
      field_values: JSON.stringify(validatedValues),
      created_by: userId,
      updated_by: userId,
    })
    .returning('*');

  return asset;
}

export async function updateAsset(
  id: string,
  fieldValues: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const existing = await db('app.assets').where('id', id).first();
  if (!existing) throw new NotFoundError('Asset not found');

  const validatedValues = await validateAssetData(fieldValues, true);

  // Merge with existing values
  const mergedValues = { ...existing.field_values, ...validatedValues };

  const [asset] = await db('app.assets')
    .where('id', id)
    .update({
      field_values: JSON.stringify(mergedValues),
      updated_by: userId,
      updated_at: db.fn.now(),
    })
    .returning('*');

  return asset;
}

export async function deleteAsset(id: string): Promise<void> {
  const existing = await db('app.assets').where('id', id).first();
  if (!existing) throw new NotFoundError('Asset not found');

  // Soft delete
  await db('app.assets').where('id', id).update({ is_active: false, updated_at: db.fn.now() });
}

export async function bulkUpsertAssets(
  records: Array<{ asset_tag: string; field_values: Record<string, unknown> }>,
  userId: string
): Promise<{ success: number; errors: Array<{ row: number; errors: Record<string, string[]> | string }> }> {
  const results = { success: 0, errors: [] as Array<{ row: number; errors: Record<string, string[]> | string }> };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      const validatedValues = await validateAssetData(record.field_values, false);
      const existing = await db('app.assets').where('asset_tag', record.asset_tag).first();

      if (existing) {
        const merged = { ...existing.field_values, ...validatedValues };
        await db('app.assets').where('id', existing.id).update({
          field_values: JSON.stringify(merged),
          updated_by: userId,
          updated_at: db.fn.now(),
          is_active: true,
        });
      } else {
        await db('app.assets').insert({
          asset_tag: record.asset_tag,
          field_values: JSON.stringify(validatedValues),
          created_by: userId,
          updated_by: userId,
        });
      }
      results.success++;
    } catch (err: unknown) {
      const error = err as { details?: Record<string, string[]>; message?: string };
      results.errors.push({
        row: i + 1,
        errors: error.details || error.message || 'Unknown error',
      });
    }
  }

  return results;
}

export async function getAssetFieldValues(fieldKey: string): Promise<string[]> {
  const result = await db('app.assets')
    .where('is_active', true)
    .whereNotNull(db.raw("field_values->>?", [fieldKey]))
    .select(db.raw("DISTINCT field_values->>? as value", [fieldKey]))
    .limit(100);

  return result.map((r: { value: string }) => r.value).filter(Boolean);
}
