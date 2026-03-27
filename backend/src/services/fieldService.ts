import db from '../config/database';
import redis from '../config/redis';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors';

export interface FieldDefinition {
  id: string;
  field_key: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_active: boolean;
  is_system: boolean;
  is_filterable: boolean;
  is_exportable: boolean;
  sort_order: number;
  validation_rules: Record<string, unknown> | null;
  select_options: string[] | null;
  default_value: string | null;
  placeholder: string | null;
  help_text: string | null;
  field_group: string | null;
}

const FIELDS_CACHE_KEY = 'field_definitions:all';
const VALID_FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean', 'email', 'url', 'ip_address', 'textarea'];

export async function getActiveFields(): Promise<FieldDefinition[]> {
  const cached = await redis.get(FIELDS_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const fields = await db('admin.field_definitions')
    .where('is_active', true)
    .orderBy('sort_order', 'asc');

  await redis.set(FIELDS_CACHE_KEY, JSON.stringify(fields), 'EX', 600);
  return fields;
}

export async function getAllFields(): Promise<FieldDefinition[]> {
  return db('admin.field_definitions').orderBy('sort_order', 'asc');
}

export async function getFieldById(id: string): Promise<FieldDefinition> {
  const field = await db('admin.field_definitions').where('id', id).first();
  if (!field) throw new NotFoundError('Field not found');
  return field;
}

export async function createField(data: Partial<FieldDefinition>, userId: string): Promise<FieldDefinition> {
  if (!data.field_key || !data.display_name || !data.field_type) {
    throw new BadRequestError('field_key, display_name, and field_type are required');
  }

  if (!VALID_FIELD_TYPES.includes(data.field_type)) {
    throw new BadRequestError(`Invalid field_type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
  }

  // Validate field_key format
  if (!/^[a-z][a-z0-9_]*$/.test(data.field_key)) {
    throw new BadRequestError('field_key must start with a letter and contain only lowercase letters, numbers, and underscores');
  }

  const existing = await db('admin.field_definitions').where('field_key', data.field_key).first();
  if (existing) throw new ConflictError('Field key already exists');

  const [field] = await db('admin.field_definitions')
    .insert({
      field_key: data.field_key,
      display_name: data.display_name,
      field_type: data.field_type,
      is_required: data.is_required || false,
      is_active: data.is_active !== false,
      is_system: false,
      is_filterable: data.is_filterable !== false,
      is_exportable: data.is_exportable !== false,
      sort_order: data.sort_order || 0,
      validation_rules: data.validation_rules ? JSON.stringify(data.validation_rules) : null,
      select_options: data.select_options ? JSON.stringify(data.select_options) : null,
      default_value: data.default_value || null,
      placeholder: data.placeholder || null,
      help_text: data.help_text || null,
      field_group: data.field_group || null,
      created_by: userId,
      updated_by: userId,
    })
    .returning('*');

  await invalidateFieldsCache();
  return field;
}

export async function updateField(id: string, data: Partial<FieldDefinition>, userId: string): Promise<FieldDefinition> {
  const existing = await getFieldById(id);

  // System fields have restrictions
  if (existing.is_system && data.field_key && data.field_key !== existing.field_key) {
    throw new BadRequestError('Cannot change field_key of system fields');
  }

  if (data.field_type && !VALID_FIELD_TYPES.includes(data.field_type)) {
    throw new BadRequestError(`Invalid field_type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
  }

  const updateData: Record<string, unknown> = { updated_by: userId, updated_at: db.fn.now() };

  const allowedUpdates = [
    'display_name', 'field_type', 'is_required', 'is_active', 'is_filterable',
    'is_exportable', 'sort_order', 'default_value', 'placeholder', 'help_text', 'field_group',
  ];

  if (!existing.is_system) {
    allowedUpdates.push('field_key');
  }

  for (const key of allowedUpdates) {
    if (data[key as keyof FieldDefinition] !== undefined) {
      updateData[key] = data[key as keyof FieldDefinition];
    }
  }

  if (data.validation_rules !== undefined) {
    updateData.validation_rules = data.validation_rules ? JSON.stringify(data.validation_rules) : null;
  }
  if (data.select_options !== undefined) {
    updateData.select_options = data.select_options ? JSON.stringify(data.select_options) : null;
  }

  const [field] = await db('admin.field_definitions')
    .where('id', id)
    .update(updateData)
    .returning('*');

  await invalidateFieldsCache();
  return field;
}

export async function deleteField(id: string): Promise<void> {
  const field = await getFieldById(id);
  if (field.is_system) {
    throw new BadRequestError('Cannot delete system fields');
  }

  await db('admin.field_definitions').where('id', id).delete();
  await invalidateFieldsCache();
}

async function invalidateFieldsCache(): Promise<void> {
  await redis.del(FIELDS_CACHE_KEY);
}
