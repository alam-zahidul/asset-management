import { z } from 'zod';

const ipv4Regex = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}[a-zA-Z0-9]$/;

export const loginSchema = z.object({
  username: z.string()
    .min(1, 'Username is required')
    .max(100, 'Username too long')
    .regex(/^[a-zA-Z0-9._@-]+$/, 'Invalid username format'),
  password: z.string()
    .min(1, 'Password is required')
    .max(256, 'Password too long'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  sortBy: z.string().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const assetFilterSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive', 'decommissioned', 'maintenance']).optional(),
  fields: z.record(z.string(), z.string().max(500)).optional(),
}).merge(paginationSchema);

export const assetCreateSchema = z.object({
  asset_tag: z.string().max(100).optional(),
  data: z.record(z.string(), z.unknown()),
  status: z.enum(['active', 'inactive', 'decommissioned', 'maintenance']).default('active'),
});

export const assetUpdateSchema = z.object({
  asset_tag: z.string().max(100).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'inactive', 'decommissioned', 'maintenance']).optional(),
});

export const exportSchema = z.object({
  format: z.enum(['xlsx', 'csv', 'pdf']),
  fields: z.array(z.string().max(100)).min(1, 'At least one field required'),
  filters: z.record(z.string(), z.string().max(500)).optional(),
  sortBy: z.string().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export function createFieldValidator(fieldDef: {
  field_type: string;
  is_required: boolean;
  min_length?: number | null;
  max_length?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  regex_pattern?: string | null;
  select_options?: string[] | null;
}) {
  let schema: z.ZodTypeAny;

  switch (fieldDef.field_type) {
    case 'text':
    case 'textarea':
      schema = z.string();
      if (fieldDef.min_length) schema = (schema as z.ZodString).min(fieldDef.min_length);
      if (fieldDef.max_length) schema = (schema as z.ZodString).max(fieldDef.max_length);
      if (fieldDef.regex_pattern) schema = (schema as z.ZodString).regex(new RegExp(fieldDef.regex_pattern));
      break;

    case 'number':
      schema = z.coerce.number();
      if (fieldDef.min_value != null) schema = (schema as z.ZodNumber).min(fieldDef.min_value);
      if (fieldDef.max_value != null) schema = (schema as z.ZodNumber).max(fieldDef.max_value);
      break;

    case 'email':
      schema = z.string().email();
      break;

    case 'ip_address':
      schema = z.string().refine(
        (val) => ipv4Regex.test(val) || ipv6Regex.test(val),
        { message: 'Invalid IP address' }
      );
      break;

    case 'url':
      schema = z.string().url();
      break;

    case 'date':
    case 'datetime':
      schema = z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' });
      break;

    case 'boolean':
      schema = z.coerce.boolean();
      break;

    case 'select':
      if (fieldDef.select_options?.length) {
        schema = z.enum(fieldDef.select_options as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;

    case 'multiselect':
      if (fieldDef.select_options?.length) {
        schema = z.array(z.enum(fieldDef.select_options as [string, ...string[]]));
      } else {
        schema = z.array(z.string());
      }
      break;

    default:
      schema = z.string();
  }

  if (!fieldDef.is_required) {
    schema = schema.optional().nullable();
  }

  return schema;
}

export const validators = {
  ipv4: (val: string) => ipv4Regex.test(val),
  ipv6: (val: string) => ipv6Regex.test(val),
  mac: (val: string) => macRegex.test(val),
  hostname: (val: string) => hostnameRegex.test(val),
};
