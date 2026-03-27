import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import config from '../config';
import db from '../config/database';
import redis from '../config/redis';
import { authenticateLdap, LdapUser } from './ldapService';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

export interface TokenPayload {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

async function upsertUser(ldapUser: LdapUser): Promise<string> {
  const existing = await db('auth.users').where('username', ldapUser.username).first();

  if (existing) {
    await db('auth.users').where('id', existing.id).update({
      email: ldapUser.email,
      display_name: ldapUser.displayName,
      department: ldapUser.department,
      ldap_dn: ldapUser.dn,
      last_login: db.fn.now(),
      updated_at: db.fn.now(),
    });
    return existing.id;
  }

  const [user] = await db('auth.users')
    .insert({
      username: ldapUser.username,
      email: ldapUser.email,
      display_name: ldapUser.displayName,
      department: ldapUser.department,
      ldap_dn: ldapUser.dn,
      last_login: db.fn.now(),
    })
    .returning('id');

  // Assign default viewer role
  const viewerRole = await db('auth.roles').where('name', 'viewer').first();
  if (viewerRole) {
    await db('auth.user_roles').insert({ user_id: user.id, role_id: viewerRole.id });
  }

  return user.id;
}

async function getUserPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
  const cacheKey = `user:permissions:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const roles = await db('auth.user_roles')
    .join('auth.roles', 'auth.roles.id', 'auth.user_roles.role_id')
    .where('auth.user_roles.user_id', userId)
    .select('auth.roles.name');

  const permissions = await db('auth.user_roles')
    .join('auth.role_permissions', 'auth.role_permissions.role_id', 'auth.user_roles.role_id')
    .join('auth.permissions', 'auth.permissions.id', 'auth.role_permissions.permission_id')
    .where('auth.user_roles.user_id', userId)
    .select(db.raw("auth.permissions.resource || ':' || auth.permissions.action as perm"))
    .distinct();

  const result = {
    roles: roles.map((r) => r.name),
    permissions: permissions.map((p) => p.perm),
  };

  await redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5 min cache
  return result;
}

function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

function generateRefreshToken(): string {
  return uuid() + '-' + uuid();
}

export async function login(username: string, password: string): Promise<AuthTokens> {
  const ldapUser = await authenticateLdap(username, password);
  const userId = await upsertUser(ldapUser);

  const user = await db('auth.users').where('id', userId).first();
  if (!user.is_active) {
    throw new ForbiddenError('Account is disabled');
  }

  const { roles, permissions } = await getUserPermissions(userId);

  const tokenPayload: TokenPayload = {
    userId,
    username: user.username,
    roles,
    permissions,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken();

  // Store refresh token hash
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db('auth.refresh_tokens').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  logger.info(`User ${username} logged in successfully`);

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const tokens = await db('auth.refresh_tokens')
    .where('is_revoked', false)
    .where('expires_at', '>', new Date())
    .select('*');

  let matchedToken: { id: string; user_id: string } | null = null;
  for (const t of tokens) {
    if (await bcrypt.compare(refreshToken, t.token_hash)) {
      matchedToken = t;
      break;
    }
  }

  if (!matchedToken) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Revoke old token
  await db('auth.refresh_tokens').where('id', matchedToken.id).update({ is_revoked: true });

  const user = await db('auth.users').where('id', matchedToken.user_id).first();
  if (!user || !user.is_active) {
    throw new ForbiddenError('Account is disabled');
  }

  const { roles, permissions } = await getUserPermissions(user.id);

  const tokenPayload: TokenPayload = {
    userId: user.id,
    username: user.username,
    roles,
    permissions,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken();

  const tokenHash = await bcrypt.hash(newRefreshToken, 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db('auth.refresh_tokens').insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: config.jwt.expiresIn,
  };
}

export async function logout(userId: string): Promise<void> {
  await db('auth.refresh_tokens').where('user_id', userId).update({ is_revoked: true });
  await redis.del(`user:permissions:${userId}`);
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function invalidatePermissionCache(userId: string): Promise<void> {
  await redis.del(`user:permissions:${userId}`);
}
