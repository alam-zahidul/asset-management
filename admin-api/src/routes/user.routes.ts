import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

// List all users
router.get('/', authorize('users.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT u.id, u.username, u.email, u.display_name, u.department,
              u.is_active, u.last_login, u.created_at,
              ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL) as roles
       FROM auth.users u
       LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
       LEFT JOIN auth.roles r ON r.id = ur.role_id
       GROUP BY u.id
       ORDER BY u.display_name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) as total FROM auth.users');

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user
router.get('/:id', authorize('users.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idSchema = z.string().uuid();
    if (!idSchema.safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const result = await query(
      `SELECT u.id, u.username, u.email, u.display_name, u.department,
              u.is_active, u.last_login, u.created_at,
              ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL) as roles
       FROM auth.users u
       LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
       LEFT JOIN auth.roles r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Assign roles to user
const assignRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1),
});

router.post('/:id/roles', authorize('users.manage'), validate(assignRolesSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idSchema = z.string().uuid();
    if (!idSchema.safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const { roleIds } = req.body;
    const userId = req.params.id;

    // Verify user exists
    const userResult = await query('SELECT id FROM auth.users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify all roles exist
    const rolesResult = await query('SELECT id FROM auth.roles WHERE id = ANY($1)', [roleIds]);
    if (rolesResult.rows.length !== roleIds.length) {
      res.status(400).json({ error: 'One or more role IDs are invalid' });
      return;
    }

    // Remove existing roles and assign new ones
    await query('DELETE FROM auth.user_roles WHERE user_id = $1', [userId]);

    for (const roleId of roleIds) {
      await query(
        'INSERT INTO auth.user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
        [userId, roleId, req.user!.userId]
      );
    }

    // Invalidate permissions cache
    await redis.del(`user:permissions:${userId}`);

    // Audit log
    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, 'user.roles.update', 'user', $2, $3, $4, $5)`,
      [req.user!.userId, userId, JSON.stringify({ roleIds }),
       req.ip || '', req.get('user-agent') || '']
    );

    res.json({ message: 'Roles updated successfully' });
  } catch (err) {
    logger.error('Failed to assign roles', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to assign roles' });
  }
});

// Toggle user active status
router.patch('/:id/status', authorize('users.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idSchema = z.string().uuid();
    if (!idSchema.safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const statusSchema = z.object({ is_active: z.boolean() });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'is_active boolean required' });
      return;
    }

    await query('UPDATE auth.users SET is_active = $1, updated_at = NOW() WHERE id = $2', [
      parsed.data.is_active, req.params.id,
    ]);

    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, 'user.status.update', 'user', $2, $3, $4, $5)`,
      [req.user!.userId, req.params.id, JSON.stringify({ is_active: parsed.data.is_active }),
       req.ip || '', req.get('user-agent') || '']
    );

    res.json({ message: 'User status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

export default router;
