import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/**
 * Shared Redis connection. BullMQ, rate limiting, presence and
 * leaderboards will each create purpose-scoped connections from this
 * URL later; the app-level client is for simple KV/cache use.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
