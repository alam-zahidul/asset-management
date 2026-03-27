import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { sanitizeString } from '../utils/sanitize';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

// List roles
router.get('/', authorize('roles.manage'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, 
        (SELECT COUNT(*) FROM auth.user_roles WHERE role_id = r.id) as user_count,
        ARRAY_AGG(p.name) FILTER (WHERE p.name IS NOT NULL) as permissions
       FROM auth.roles r
       LEFT JOIN auth.role_permissions rp ON rp.role_id = r.id
       LEFT JOIN auth.permissions p ON p.id = rp.permission_id
       GROUP BY r.id
       ORDER BY r.name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// List all permissions
router.get('/permissions', authorize('roles.manage'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM auth.permissions ORDER BY resource, action');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Create role
const roleCreateSchema = z.object({
  name: z.string().min(2).max(100).regex(/^[a-z][a-z0-9_-]*$/, 'Lowercase with dashes/underscores'),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().uuid()),
});

router.post('/', authorize('roles.manage'), validate(roleCreateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, permissionIds } = req.body;

    const existing = await query('SELECT id FROM auth.roles WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Role already exists' });
      return;
    }

    const result = await query(
      'INSERT INTO auth.roles (name, description) VALUES ($1, $2) RETURNING *',
      [sanitizeString(name), description ? sanitizeString(description) : null]
    );
    const role = result.rows[0];

    // Assign permissions
    for (const permId of permissionIds) {
      await query(
        'INSERT INTO auth.role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [role.id, permId]
      );
    }

    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, 'role.create', 'role', $2, $3, $4, $5)`,
      [req.user!.userId, role.id, JSON.stringify({ name, permissionCount: permissionIds.length }),
       req.ip || '', req.get('user-agent') || '']
    );

    res.status(201).json(role);
  } catch (err) {
    logger.error('Failed to create role', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update role permissions
const roleUpdateSchema = z.object({
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().uuid()),
});

router.put('/:id', authorize('roles.manage'), validate(roleUpdateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idSchema = z.string().uuid();
    if (!idSchema.safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid role ID' });
      return;
    }

    const existing = await query('SELECT * FROM auth.roles WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    const { description, permissionIds } = req.body;

    if (description !== undefined) {
      await query('UPDATE auth.roles SET description = $1, updated_at = NOW() WHERE id = $2', [
        sanitizeString(description), req.params.id,
      ]);
    }

    // Update permissions
    await query('DELETE FROM auth.role_permissions WHERE role_id = $1', [req.params.id]);
    for (const permId of permissionIds) {
      await query(
        'INSERT INTO auth.role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, permId]
      );
    }

    // Invalidate permission caches for all users with this role
    const users = await query('SELECT user_id FROM auth.user_roles WHERE role_id = $1', [req.params.id]);
    for (const user of users.rows) {
      await redis.del(`user:permissions:${user.user_id}`);
    }

    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, 'role.update', 'role', $2, $3, $4, $5)`,
      [req.user!.userId, req.params.id, JSON.stringify({ permissionCount: permissionIds.length }),
       req.ip || '', req.get('user-agent') || '']
    );

    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    logger.error('Failed to update role', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete role
router.delete('/:id', authorize('roles.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idSchema = z.string().uuid();
    if (!idSchema.safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid role ID' });
      return;
    }

    const existing = await query('SELECT * FROM auth.roles WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    if (existing.rows[0].is_system) {
      res.status(400).json({ error: 'Cannot delete system roles' });
      return;
    }

    await query('DELETE FROM auth.roles WHERE id = $1', [req.params.id]);

    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, 'role.delete', 'role', $2, $3, $4, $5)`,
      [req.user!.userId, req.params.id, JSON.stringify({ name: existing.rows[0].name }),
       req.ip || '', req.get('user-agent') || '']
    );

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

export default router;
