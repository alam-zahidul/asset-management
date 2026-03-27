import { Request, Response, NextFunction } from 'express';
import { sanitizeObject, sanitizeString } from '../utils/sanitize';

/**
 * Middleware to sanitize all incoming request body data.
 * Strips HTML tags, null bytes, and trims whitespace from all string values.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Middleware to sanitize query parameters.
 */
export function sanitizeQuery(req: Request, _res: Response, next: NextFunction): void {
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        (req.query as Record<string, string>)[key] = sanitizeString(value);
      }
    }
  }
  next();
}
