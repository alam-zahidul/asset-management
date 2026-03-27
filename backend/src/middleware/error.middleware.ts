import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Don't expose internal error details in production
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { message: err.message }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
