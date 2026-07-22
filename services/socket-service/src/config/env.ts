import { z } from 'zod';
import { validateEnv, envField } from '@devarena/shared-utils';

/**
 * Fail-fast configuration. The service refuses to boot on a bad value
 * rather than failing under load. The JWT secret is intentionally the
 * SAME one the (already-built) auth module signs access tokens with —
 * this service only VERIFIES, it never issues.
 */
const schema = z.object({
  NODE_ENV: envField.nodeEnv,
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  REDIS_URL: envField.url,
  CORS_ORIGIN: envField.nonEmpty.default('http://localhost:5173'),

  JWT_ACCESS_SECRET: envField.nonEmpty,

  // Presence / liveness
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(25_000),
  HEARTBEAT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60_000),
  IDLE_AFTER_MS: z.coerce.number().int().min(5_000).default(120_000),

  // Connection-recovery window (Socket.IO state recovery on reconnect)
  RECOVERY_WINDOW_MS: z.coerce.number().int().min(0).default(120_000),

  // Security ceilings
  MAX_CONNECTIONS_PER_USER: z.coerce.number().int().min(1).max(50).default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(100).default(10_000),
  RATE_LIMIT_MAX_EVENTS: z.coerce.number().int().min(1).default(100),
  REPLAY_WINDOW_MS: z.coerce.number().int().min(1000).default(30_000),

  // Room ceilings per type
  BATTLE_ROOM_CAPACITY: z.coerce.number().int().min(2).default(2),
  COLLAB_ROOM_CAPACITY: z.coerce.number().int().min(2).default(50),
  INTERVIEW_ROOM_CAPACITY: z.coerce.number().int().min(2).default(4),
  ROOM_TTL_SECONDS: z.coerce.number().int().min(60).default(86_400),
});

export const env = validateEnv(schema, process.env);
export type Env = typeof env;
