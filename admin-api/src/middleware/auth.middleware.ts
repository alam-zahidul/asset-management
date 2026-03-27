import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

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

  try {
    const decoded = jwt.verify(authHeader.substring(7), config.jwt.secret, {
      issuer: 'asset-management',
      audience: 'asset-management-api',
    }) as AuthenticatedRequest['user'];

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user?.roles.includes('admin')) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export function authorize(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const has = permissions.every((p) => req.user!.permissions.includes(p));
    if (!has) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
