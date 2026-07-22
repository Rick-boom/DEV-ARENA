import type { Redis } from 'ioredis';
import type { IRateLimiter } from '../interfaces/ai.interfaces.js';

/** Fixed-window per-user limiter (INCR + PEXPIRE); cross-node correct. */
export class RedisRateLimiter implements IRateLimiter {
  constructor(private readonly redis: Redis) {}
  async hit(key: string, windowMs: number, max: number): Promise<boolean> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.pexpire(key, windowMs);
    return count <= max;
  }
}
