import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'asset_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  ldap: {
    url: process.env.LDAP_URL || '',
    baseDN: process.env.LDAP_BASE_DN || '',
    bindDN: process.env.LDAP_BIND_DN || '',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    searchFilter: process.env.LDAP_SEARCH_FILTER || '(sAMAccountName={{username}})',
    groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE || '',
    tlsOptions: {
      rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
  },

  cors: {
    origin: process.env.BACKEND_CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },

  upload: {
    maxSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10),
    dir: process.env.UPLOAD_DIR || '/tmp/uploads',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
} as const;
