import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.ADMIN_API_PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'asset_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
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
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
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
    origin: process.env.ADMIN_CORS_ORIGIN || 'http://localhost:3003',
    credentials: true,
  },
} as const;
