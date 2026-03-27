import Redis from 'ioredis';
import { config } from './index';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
  maxRetriesPerRequest: 3,
});
