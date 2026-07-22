import { pino, type Logger } from 'pino';
import { env } from '../config/env.js';

/**
 * Structured JSON logger (pino). In production every line is one JSON
 * object — machine-parseable by Loki/CloudWatch. In development
 * pino-pretty renders it for humans. Child loggers add a `module`
 * field so a single grep isolates one service's logs.
 */
export const logger: Logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'devarena-backend' },
  redact: ['req.headers.authorization', '*.password', '*.passwordHash'],
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});

export function createModuleLogger(module: string): Logger {
  return logger.child({ module });
}
