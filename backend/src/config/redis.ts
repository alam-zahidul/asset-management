import Redis from 'ioredis';
import config from './index';
import logger from '../utils/logger';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => logger.error('Redis connection error', err));
redis.on('connect', () => logger.info('Redis connected'));

export default redis;
