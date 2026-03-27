import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    roles: string[];
    permissions: string[];
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'asset-management',
      audience: 'asset-management-api',
    }) as {
      userId: string;
      username: string;
      roles: string[];
      permissions: string[];
    };

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasPermission = requiredPermissions.every((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasPermission) {
      logger.warn('Access denied', {
        userId: req.user.userId,
        required: requiredPermissions,
        has: req.user.permissions,
      });
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function authorizeRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasRole = roles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: 'Insufficient role' });
      return;
    }

    next();
  };
}
