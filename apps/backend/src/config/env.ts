import { z } from 'zod';
import { validateEnv, envField } from '@devarena/shared-utils';

/**
 * Single source of truth for backend configuration.
 * Every module imports `env` from here — nobody touches process.env
 * directly, so config is typed, validated, and greppable.
 */
const schema = z.object({
  NODE_ENV: envField.nodeEnv,
  PORT: envField.port.default(4000),
  DATABASE_URL: envField.url,
  REDIS_URL: envField.url,
  CORS_ORIGIN: envField.nonEmpty.default('http://localhost:5173'),
  JWT_ACCESS_SECRET: envField.nonEmpty,
  JWT_REFRESH_SECRET: envField.nonEmpty,
});

export const env = validateEnv(schema, process.env);
export type Env = typeof env;
