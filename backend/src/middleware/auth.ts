import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/authService';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }

  const token = authHeader.substring(7);
  req.user = verifyToken(token);
  next();
}

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (req.user.roles.includes('admin')) {
      return next();
    }

    const hasPermission = requiredPermissions.every((p) => req.user!.permissions.includes(p));
    if (!hasPermission) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const hasRole = roles.some((r) => req.user!.roles.includes(r));
    if (!hasRole) {
      throw new ForbiddenError('Insufficient role');
    }

    next();
  };
}
