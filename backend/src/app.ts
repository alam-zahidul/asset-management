import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeMiddleware } from './middleware/sanitize';
import authRoutes from './routes/auth';
import assetRoutes from './routes/assets';
import fieldRoutes from './routes/fields';
import adminRoutes from './routes/admin';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Rate limiting
app.use(rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
}));

// Stricter rate limit for auth endpoints
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { status: 'error', message: 'Too many login attempts, please try again later' },
}));

// Sanitization
app.use(sanitizeMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/admin', adminRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info(`Backend server running on port ${config.port}`);
});

export default app;
