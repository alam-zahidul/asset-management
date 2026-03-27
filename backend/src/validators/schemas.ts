import Joi from 'joi';

export const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(1).max(500).required(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const assetCreateSchema = Joi.object({
  asset_tag: Joi.string().trim().min(1).max(100).required(),
  field_values: Joi.object().required(),
});

export const assetUpdateSchema = Joi.object({
  field_values: Joi.object().required(),
});

export const assetQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(25),
  search: Joi.string().trim().max(200).allow('').optional(),
  sortBy: Joi.string().trim().max(100).optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  filters: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.number())).optional(),
});

export const exportSchema = Joi.object({
  format: Joi.string().valid('xlsx', 'csv', 'pdf').default('xlsx'),
  fieldIds: Joi.array().items(Joi.string().uuid()).optional(),
  filters: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.number())).optional(),
  search: Joi.string().trim().max(200).allow('').optional(),
});

export const fieldCreateSchema = Joi.object({
  field_key: Joi.string().trim().min(1).max(100).pattern(/^[a-z][a-z0-9_]*$/).required(),
  display_name: Joi.string().trim().min(1).max(255).required(),
  field_type: Joi.string().valid('text', 'number', 'date', 'select', 'boolean', 'email', 'url', 'ip_address', 'textarea').required(),
  is_required: Joi.boolean().default(false),
  is_active: Joi.boolean().default(true),
  is_filterable: Joi.boolean().default(true),
  is_exportable: Joi.boolean().default(true),
  sort_order: Joi.number().integer().min(0).default(0),
  validation_rules: Joi.object().optional().allow(null),
  select_options: Joi.array().items(Joi.string()).optional().allow(null),
  default_value: Joi.string().max(500).optional().allow(null, ''),
  placeholder: Joi.string().max(255).optional().allow(null, ''),
  help_text: Joi.string().max(500).optional().allow(null, ''),
  field_group: Joi.string().max(100).optional().allow(null, ''),
});

export const fieldUpdateSchema = Joi.object({
  display_name: Joi.string().trim().min(1).max(255).optional(),
  field_key: Joi.string().trim().min(1).max(100).pattern(/^[a-z][a-z0-9_]*$/).optional(),
  field_type: Joi.string().valid('text', 'number', 'date', 'select', 'boolean', 'email', 'url', 'ip_address', 'textarea').optional(),
  is_required: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  is_filterable: Joi.boolean().optional(),
  is_exportable: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  validation_rules: Joi.object().optional().allow(null),
  select_options: Joi.array().items(Joi.string()).optional().allow(null),
  default_value: Joi.string().max(500).optional().allow(null, ''),
  placeholder: Joi.string().max(255).optional().allow(null, ''),
  help_text: Joi.string().max(500).optional().allow(null, ''),
  field_group: Joi.string().max(100).optional().allow(null, ''),
}).min(1);

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(25),
});

export const uuidParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

export const userRoleSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  roleId: Joi.string().uuid().required(),
});

export const auditQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(25),
  userId: Joi.string().uuid().optional(),
  resource: Joi.string().max(100).optional(),
  action: Joi.string().max(100).optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

export const exportTemplateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  field_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
  filters: Joi.object().optional().allow(null),
  format: Joi.string().valid('xlsx', 'csv', 'pdf').default('xlsx'),
});
