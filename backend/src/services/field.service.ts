import { query, getClient } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface FieldDefinition {
  id: string;
  field_key: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_active: boolean;
  is_system: boolean;
  display_order: number;
  field_group: string;
  placeholder: string | null;
  help_text: string | null;
  default_value: string | null;
  validation_rules: Record<string, unknown>;
  select_options: string[];
  min_length: number | null;
  max_length: number | null;
  min_value: number | null;
  max_value: number | null;
  regex_pattern: string | null;
  is_unique: boolean;
  is_filterable: boolean;
  is_sortable: boolean;
  is_exportable: boolean;
}

const FIELDS_CACHE_KEY = 'field_definitions:active';
const FIELDS_CACHE_TTL = 600; // 10 minutes

export class FieldService {
  async getActiveFields(): Promise<FieldDefinition[]> {
    // Check cache
    const cached = await redis.get(FIELDS_CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const result = await query(
      `SELECT * FROM admin.field_definitions WHERE is_active = true ORDER BY display_order ASC`
    );

    const fields = result.rows;
    await redis.setex(FIELDS_CACHE_KEY, FIELDS_CACHE_TTL, JSON.stringify(fields));

    return fields;
  }

  async getFieldByKey(fieldKey: string): Promise<FieldDefinition | null> {
    const fields = await this.getActiveFields();
    return fields.find((f) => f.field_key === fieldKey) || null;
  }

  async getFieldGroups() {
    const result = await query(
      `SELECT * FROM admin.field_groups WHERE is_active = true ORDER BY display_order ASC`
    );
    return result.rows;
  }

  async validateAssetData(data: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }> {
    const fields = await this.getActiveFields();
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field.field_key];

      // Check required fields
      if (field.is_required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.display_name} is required`);
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

      // Type validation
      switch (field.field_type) {
        case 'number':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(`${field.display_name} must be a number`);
          } else {
            const num = Number(value);
            if (field.min_value != null && num < field.min_value) {
              errors.push(`${field.display_name} must be at least ${field.min_value}`);
            }
            if (field.max_value != null && num > field.max_value) {
              errors.push(`${field.display_name} must be at most ${field.max_value}`);
            }
          }
          break;

        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            errors.push(`${field.display_name} must be a valid email`);
          }
          break;

        case 'ip_address':
          if (!/^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(String(value)) &&
              !/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(String(value))) {
            errors.push(`${field.display_name} must be a valid IP address`);
          }
          break;

        case 'url':
          try {
            new URL(String(value));
          } catch {
            errors.push(`${field.display_name} must be a valid URL`);
          }
          break;

        case 'date':
        case 'datetime':
          if (isNaN(Date.parse(String(value)))) {
            errors.push(`${field.display_name} must be a valid date`);
          }
          break;

        case 'select':
          if (field.select_options?.length && !field.select_options.includes(String(value))) {
            errors.push(`${field.display_name} must be one of: ${field.select_options.join(', ')}`);
          }
          break;

        case 'multiselect':
          if (Array.isArray(value) && field.select_options?.length) {
            const invalid = (value as string[]).filter((v) => !field.select_options.includes(v));
            if (invalid.length) {
              errors.push(`${field.display_name} contains invalid values: ${invalid.join(', ')}`);
            }
          }
          break;
      }

      // String length validation
      if (typeof value === 'string') {
        if (field.min_length && value.length < field.min_length) {
          errors.push(`${field.display_name} must be at least ${field.min_length} characters`);
        }
        if (field.max_length && value.length > field.max_length) {
          errors.push(`${field.display_name} must be at most ${field.max_length} characters`);
        }
      }

      // Regex validation
      if (field.regex_pattern && typeof value === 'string') {
        if (!new RegExp(field.regex_pattern).test(value)) {
          errors.push(`${field.display_name} format is invalid`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async invalidateCache(): Promise<void> {
    await redis.del(FIELDS_CACHE_KEY);
  }
}

export const fieldService = new FieldService();
