import type { Redis } from 'ioredis';
import { createModuleLogger } from './logger.js';

const log = createModuleLogger('cache');

/**
 * Narrow cache abstraction so services depend on an interface, not on
 * ioredis (DI + trivially fakeable in unit tests). Redis being down
 * degrades to cache-miss behavior — the platform slows down, it never
 * errors out. That trade-off is deliberate for read-mostly data.
 */
export interface ICacheService {
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

export class RedisCacheService implements ICacheService {
  constructor(private readonly redis: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      log.warn({ err, key }, 'cache.get failed — treating as miss');
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      log.warn({ err, key }, 'cache.set failed — skipping');
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      log.warn({ err, keys }, 'cache.del failed — skipping');
    }
  }
}
