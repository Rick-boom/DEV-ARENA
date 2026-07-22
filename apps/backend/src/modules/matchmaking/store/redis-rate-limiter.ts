import type { Redis } from 'ioredis';
import type { IRateLimiter } from '../interfaces/matchmaking.interfaces.js';

/**
 * Fixed-window rate limiter backed by a single INCR + EXPIRE. O(1) and
 * cross-node correct (the counter lives in Redis, not per-process), so
 * a user hammering /queue/join from many tabs is limited globally.
 */
export class RedisRateLimiter implements IRateLimiter {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, windowMs: number, max: number): Promise<boolean> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.pexpire(key, windowMs);
    }
    return count <= max;
  }
}
