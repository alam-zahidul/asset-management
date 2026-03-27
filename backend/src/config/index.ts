import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'asset_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  ldap: {
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    baseDn: process.env.LDAP_BASE_DN || 'dc=company,dc=com',
    bindDn: process.env.LDAP_BIND_DN || '',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    searchFilter: process.env.LDAP_SEARCH_FILTER || '(sAMAccountName={{username}})',
    groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE || 'ou=groups,dc=company,dc=com',
    tlsRejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  cors: {
    origin: process.env.BACKEND_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },

  upload: {
    maxSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10),
    dir: process.env.UPLOAD_DIR || '/tmp/uploads',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  vmware: {
    encryptionKey: process.env.VMWARE_ENCRYPTION_KEY || '',
  },
} as const;

if (!config.jwt.secret || !config.jwt.refreshSecret) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set');
}

export default config;
