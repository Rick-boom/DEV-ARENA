import { pino, type Logger } from 'pino';
import { env } from '../config/env.js';

/**
 * Structured JSON logger. Child loggers add a `module` field; where a
 * socket is in scope we also bind `socketId` and `userId`, so one
 * connection's entire lifecycle is greppable across the log stream.
 */
export const logger: Logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'devarena-socket' },
  redact: ['*.token', '*.authorization'],
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});

export function createModuleLogger(module: string): Logger {
  return logger.child({ module });
}
