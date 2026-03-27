import knex from 'knex';
import knexConfig from './knexfile';
import config from './index';

const db = knex(knexConfig[config.env] || knexConfig.development);

export default db;
