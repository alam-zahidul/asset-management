import type { Knex } from 'knex';
import config from './index';

const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: {
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
    },
    pool: { min: 2, max: 10 },
    migrations: {
      directory: '../migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: '../seeds',
    },
  },

  production: {
    client: 'pg',
    connection: {
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      ssl: { rejectUnauthorized: true },
    },
    pool: { min: 5, max: 30 },
    migrations: {
      directory: '../migrations',
      tableName: 'knex_migrations',
    },
  },
};

export default knexConfig;
