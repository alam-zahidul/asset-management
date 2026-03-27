import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  config.nodeEnv === 'production'
    ? winston.format.json()
    : winston.format.combine(winston.format.colorize(), winston.format.simple())
);

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'backend-api' },
  transports: [
    new winston.transports.Console(),
  ],
});
