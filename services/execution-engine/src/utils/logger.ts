import { pino, type Logger } from 'pino';
import { env } from '../config/env.js';

/**
 * Structured JSON logger. One object per line in production (parseable
 * by Loki/CloudWatch); pretty-printed in development. Child loggers
 * carry a `module` field so a single grep isolates one component, and
 * a `jobId` where relevant so every line of a submission's lifecycle
 * correlates.
 */
export const logger: Logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'devarena-execution' },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});

export function createModuleLogger(module: string): Logger {
  return logger.child({ module });
}
