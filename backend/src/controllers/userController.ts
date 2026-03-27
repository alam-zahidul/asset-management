import { Request, Response } from 'express';
import db from '../config/database';
import redis from '../config/redis';
import { createAuditLog } from '../services/auditService';
import { NotFoundError, BadRequestError } from '../utils/errors';

export async function listUsers(req: Request, res: Response): Promise<void> {
  const { page = '1', limit = '25', search = '' } = req.query as Record<string, string>;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const query = db('auth.users').select('auth.users.*');

  if (search) {
    query.where(function () {
      this.where('username', 'ILIKE', `%${search}%`)
        .orWhere('display_name', 'ILIKE', `%${search}%`)
        .orWhere('email', 'ILIKE', `%${search}%`);
    });
  }

  const [users, countResult] = await Promise.all([
    query.clone().offset(offset).limit(parseInt(limit, 10)).orderBy('created_at', 'desc'),
    query.clone().clearSelect().count('* as total').first(),
  ]);

  // Attach roles
  const userIds = users.map((u: { id: string }) => u.id);
  const userRoles = await db('auth.user_roles')
    .join('auth.roles', 'auth.roles.id', 'auth.user_roles.role_id')
    .whereIn('auth.user_roles.user_id', userIds)
    .select('auth.user_roles.user_id', 'auth.roles.id as role_id', 'auth.roles.name as role_name');

  const rolesMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const ur of userRoles) {
    if (!rolesMap.has(ur.user_id)) rolesMap.set(ur.user_id, []);
    rolesMap.get(ur.user_id)!.push({ id: ur.role_id, name: ur.role_name });
  }

  const usersWithRoles = users.map((u: { id: string }) => ({
    ...u,
    roles: rolesMap.get(u.id) || [],
  }));

  res.json({
    status: 'success',
    data: {
      data: usersWithRoles,
      total: Number(countResult?.total || 0),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    },
  });
}

export async function listRoles(_req: Request, res: Response): Promise<void> {
  const roles = await db('auth.roles').orderBy('name', 'asc');
  res.json({ status: 'success', data: roles });
}

export async function assignRole(req: Request, res: Response): Promise<void> {
  const { userId, roleId } = req.body;

  const user = await db('auth.users').where('id', userId).first();
  if (!user) throw new NotFoundError('User not found');

  const role = await db('auth.roles').where('id', roleId).first();
  if (!role) throw new NotFoundError('Role not found');

  const existing = await db('auth.user_roles').where({ user_id: userId, role_id: roleId }).first();
  if (existing) throw new BadRequestError('User already has this role');

  await db('auth.user_roles').insert({
    user_id: userId,
    role_id: roleId,
    assigned_by: req.user!.userId,
  });

  // Invalidate cached permissions
  await redis.del(`user:permissions:${userId}`);

  await createAuditLog({
    userId: req.user!.userId,
    action: 'assign_role',
    resource: 'user_role',
    resourceId: userId,
    newValues: { role: role.name },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ status: 'success', message: 'Role assigned' });
}

export async function removeRole(req: Request, res: Response): Promise<void> {
  const { userId, roleId } = req.body;

  const deleted = await db('auth.user_roles')
    .where({ user_id: userId, role_id: roleId })
    .delete();

  if (!deleted) throw new NotFoundError('User role assignment not found');

  await redis.del(`user:permissions:${userId}`);

  const role = await db('auth.roles').where('id', roleId).first();

  await createAuditLog({
    userId: req.user!.userId,
    action: 'remove_role',
    resource: 'user_role',
    resourceId: userId,
    oldValues: { role: role?.name },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ status: 'success', message: 'Role removed' });
}

export async function toggleUserActive(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = await db('auth.users').where('id', id).first();
  if (!user) throw new NotFoundError('User not found');

  const newStatus = !user.is_active;
  await db('auth.users').where('id', id).update({ is_active: newStatus, updated_at: db.fn.now() });

  if (!newStatus) {
    // Revoke all refresh tokens
    await db('auth.refresh_tokens').where('user_id', id).update({ is_revoked: true });
    await redis.del(`user:permissions:${id}`);
  }

  await createAuditLog({
    userId: req.user!.userId,
    action: newStatus ? 'activate_user' : 'deactivate_user',
    resource: 'user',
    resourceId: id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ status: 'success', data: { is_active: newStatus } });
}
