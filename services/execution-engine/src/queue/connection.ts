import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/**
 * Shared Redis connection factory for BullMQ. `maxRetriesPerRequest:
 * null` is REQUIRED by BullMQ for blocking commands. A single factory
 * keeps producer and worker connection options identical.
 */
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
