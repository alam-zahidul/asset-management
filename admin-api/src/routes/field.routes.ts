import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, authenticate, requireAdmin, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { sanitizeString } from '../utils/sanitize';
import { logger } from '../utils/logger';

const router = Router();

const fieldCreateSchema = z.object({
  field_key: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, 'Field key must be lowercase with underscores'),
  display_name: z.string().min(1).max(200),
  field_type: z.enum(['text', 'number', 'date', 'datetime', 'boolean', 'select', 'multiselect', 'textarea', 'email', 'ip_address', 'url']),
  is_required: z.boolean().default(false),
  display_order: z.number().int().min(0).default(0),
  field_group: z.string().max(100).default('general'),
  placeholder: z.string().max(300).nullable().optional(),
  help_text: z.string().max(1000).nullable().optional(),
  default_value: z.string().max(500).nullable().optional(),
  validation_rules: z.record(z.unknown()).default({}),
  select_options: z.array(z.string().max(200)).default([]),
  min_length: z.number().int().min(0).nullable().optional(),
  max_length: z.number().int().min(1).nullable().optional(),
  min_value: z.number().nullable().optional(),
  max_value: z.number().nullable().optional(),
  regex_pattern: z.string().max(500).nullable().optional(),
  is_unique: z.boolean().default(false),
  is_filterable: z.boolean().default(true),
  is_sortable: z.boolean().default(true),
  is_exportable: z.boolean().default(true),
});

const fieldUpdateSchema = fieldCreateSchema.partial().omit({ field_key: true });

router.use(authenticate);

// List all field definitions
router.get('/', authorize('fields.read'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM admin.field_definitions ORDER BY display_order ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

// Get single field
router.get('/:id', authorize('fields.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idSchema = z.string().uuid();
    if (!idSchema.safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid field ID' });
      return;
    }

    const result = await query('SELECT * FROM admin.field_definitions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch field' });
  }
});

// Create field
router.post('/', authorize('fields.create'), validate(fieldCreateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    data.display_name = sanitizeString(data.display_name);

    // Check duplicate field_key
    const existing = await query('SELECT id FROM admin.field_definitions WHERE field_key = $1', [data.field_key]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Field key already exists' });
      return;
    }

    const result = await query(
      `INSERT INTO admin.field_definitions (
        field_key, display_name, field_type, is_required, display_order,
        field_group, placeholder, help_text, default_value, validation_rules,
        select_options, min_length, max_length, min_value, max_value,
        regex_pattern, is_unique, is_filterable, is_sortable, is_exportable,
        created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$21)
      RETURNING *`,
      [
        data.field_key, data.display_name, data.field_type, data.is_required,
        data.display_order, data.field_group, data.placeholder || null,
        data.help_text || null, data.default_value || null,
        JSON.stringify(data.validation_rules), JSON.stringify(data.select_options),
        data.min_length ?? null, data.max_length ?? null,
        data.min_value ?? null, data.max_value ?? null,
        data.regex_pattern || null, data.is_unique,
        data.is_filterable, data.is_sortable, data.is_exportable,
        req.user!.userId,
      ]
    );

    await redis.del('field_definitions:active');

    // Audit log
    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, 'field.create', 'field', $2, $3, $4, $5)`,
      [req.user!.userId, result.rows[0].id, JSON.stringify({ field_key: data.field_key }),
       req.ip || '', req.get('user-agent') || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to create field', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to create field' });
  }
});

// Update field
router.put('/:id', authorize('fields.update'), validate(fieldUpdateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idSchema = z.string().uuid();
    if (!idSchema.safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid field ID' });
      return;
    }

    const existing = await query('SELECT * FROM admin.field_definitions WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    // Prevent modifying system fields' core attributes
    if (existing.rows[0].is_system) {
      const protectedKeys = ['field_key', 'field_type'];
      for (const key of protectedKeys) {
        if (req.body[key] !== undefined) {
          res.status(400).json({ error: `Cannot modify ${key} of system fields` });
          return;
        }
      }
    }

    const data = req.body;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    const updatableFields = [
      'display_name', 'field_type', 'is_required', 'is_active', 'display_order',
      'field_group', 'placeholder', 'help_text', 'default_value',
      'min_length', 'max_length', 'min_value', 'max_value', 'regex_pattern',
      'is_unique', 'is_filterable', 'is_sortable', 'is_exportable',
    ];

    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${paramIdx++}`);
        values.push(typeof data[field] === 'string' ? sanitizeString(data[field]) : data[field]);
      }
    }

    // Handle JSON fields separately
    if (data.validation_rules !== undefined) {
      setClauses.push(`validation_rules = $${paramIdx++}`);
      values.push(JSON.stringify(data.validation_rules));
    }
    if (data.select_options !== undefined) {
      setClauses.push(`select_options = $${paramIdx++}`);
      values.push(JSON.stringify(data.select_options));
    }

    setClauses.push(`updated_by = $${paramIdx++}`);
    values.push(req.user!.userId);
    setClauses.push(`updated_at = NOW()`);

    values.push(req.params.id);

    const result = await query(
      `UPDATE admin.field_definitions SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    await redis.del('field_definitions:active');

    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, 'field.update', 'field', $2, $3, $4, $5)`,
      [req.user!.userId, req.params.id, JSON.stringify({ changes: Object.keys(data) }),
       req.ip || '', req.get('user-agent') || '']
    );

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to update field', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to update field' });
  }
});

// Delete field (soft delete - set inactive)
router.delete('/:id', authorize('fields.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idSchema = z.string().uuid();
    if (!idSchema.safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid field ID' });
      return;
    }

    const existing = await query('SELECT * FROM admin.field_definitions WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    if (existing.rows[0].is_system) {
      res.status(400).json({ error: 'Cannot delete system fields' });
      return;
    }

    await query('UPDATE admin.field_definitions SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    await redis.del('field_definitions:active');

    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, 'field.delete', 'field', $2, $3, $4, $5)`,
      [req.user!.userId, req.params.id, JSON.stringify({ field_key: existing.rows[0].field_key }),
       req.ip || '', req.get('user-agent') || '']
    );

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete field' });
  }
});

// Get field groups
router.get('/groups/list', authorize('fields.read'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM admin.field_groups ORDER BY display_order ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch field groups' });
  }
});

export default router;
