import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { ldapService, LdapUser } from './ldap.service';
import { logger } from '../utils/logger';

interface TokenPayload {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    roles: string[];
    permissions: string[];
  };
}

export class AuthService {
  async login(username: string, password: string, ip: string, userAgent: string): Promise<AuthResult> {
    // Authenticate via LDAP
    const ldapUser = await ldapService.authenticate(username, password);
    if (!ldapUser) {
      throw new Error('Invalid credentials');
    }

    // Upsert user in local database
    const user = await this.upsertUser(ldapUser);

    // Get user roles and permissions
    const roles = await this.getUserRoles(user.id);
    const permissions = await this.getUserPermissions(user.id);

    // Generate tokens
    const accessToken = this.generateAccessToken({
      userId: user.id,
      username: user.username,
      roles: roles.map((r) => r.name),
      permissions,
    });

    const refreshToken = await this.generateRefreshToken(user.id);

    // Update last login
    await query('UPDATE auth.users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Audit log
    await this.auditLog(user.id, 'auth.login', 'user', user.id, {}, ip, userAgent);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        roles: roles.map((r) => r.name),
        permissions,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Hash token and look up
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const result = await query(
      `SELECT rt.*, u.username FROM auth.refresh_tokens rt 
       JOIN auth.users u ON u.id = rt.user_id 
       WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    // For refresh tokens, verify with bcrypt compare against stored hashes
    const tokens = await query(
      `SELECT rt.*, u.username FROM auth.refresh_tokens rt 
       JOIN auth.users u ON u.id = rt.user_id 
       WHERE rt.user_id IS NOT NULL AND rt.revoked = false AND rt.expires_at > NOW()`
    );

    let matchedToken = null;
    for (const token of tokens.rows) {
      if (await bcrypt.compare(refreshToken, token.token_hash)) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      throw new Error('Invalid or expired refresh token');
    }

    // Revoke old token
    await query('UPDATE auth.refresh_tokens SET revoked = true WHERE id = $1', [matchedToken.id]);

    // Generate new tokens
    const roles = await this.getUserRoles(matchedToken.user_id);
    const permissions = await this.getUserPermissions(matchedToken.user_id);

    const accessToken = this.generateAccessToken({
      userId: matchedToken.user_id,
      username: matchedToken.username,
      roles: roles.map((r) => r.name),
      permissions,
    });

    const newRefreshToken = await this.generateRefreshToken(matchedToken.user_id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, ip: string, userAgent: string): Promise<void> {
    // Revoke all refresh tokens for user
    await query('UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = $1', [userId]);

    // Invalidate cached permissions
    await redis.del(`user:permissions:${userId}`);

    await this.auditLog(userId, 'auth.logout', 'user', userId, {}, ip, userAgent);
  }

  private async upsertUser(ldapUser: LdapUser) {
    const result = await query(
      `INSERT INTO auth.users (username, email, display_name, ldap_dn, department)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         ldap_dn = EXCLUDED.ldap_dn,
         department = EXCLUDED.department,
         updated_at = NOW()
       RETURNING id, username, email, display_name`,
      [ldapUser.username, ldapUser.email, ldapUser.displayName, ldapUser.dn, ldapUser.department]
    );
    return result.rows[0];
  }

  private async getUserRoles(userId: string) {
    const result = await query(
      `SELECT r.* FROM auth.roles r
       JOIN auth.user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    // Check cache first
    const cached = await redis.get(`user:permissions:${userId}`);
    if (cached) return JSON.parse(cached);

    const result = await query(
      `SELECT DISTINCT p.name FROM auth.permissions p
       JOIN auth.role_permissions rp ON rp.permission_id = p.id
       JOIN auth.user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );
    const permissions = result.rows.map((r) => r.name);

    // Cache for 5 minutes
    await redis.setex(`user:permissions:${userId}`, 300, JSON.stringify(permissions));

    return permissions;
  }

  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      issuer: 'asset-management',
      audience: 'asset-management-api',
    });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    const tokenHash = await bcrypt.hash(token, 12);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      'INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );

    return token;
  }

  async auditLog(
    userId: string | null,
    action: string,
    resource: string,
    resourceId: string,
    details: Record<string, unknown>,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await query(
      `INSERT INTO auth.audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, resource, resourceId, JSON.stringify(details), ip, userAgent]
    );
  }
}

export const authService = new AuthService();
