import type { Redis } from 'ioredis';
import { AI_CONSTANTS } from '../constants/ai.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IPromptCache } from '../interfaces/ai.interfaces.js';
import type { CoachResponse } from '../types/ai.types.js';

const log = createModuleLogger('ai-prompt-cache');
const { KEYS, CACHE } = AI_CONSTANTS;

/**
 * Redis response cache — the single biggest cost lever. Identical
 * (mode + problem + code + verdict + question) requests return a cached
 * answer for FREE instead of paying for another Gemini call. At 1M
 * requests/month a even 40% hit rate removes ~400k model calls.
 *
 * Cache failures NEVER break the request: a miss on read just means we
 * call the model; a write failure is logged and swallowed. The cache is
 * an optimization, not a dependency.
 */
export class RedisPromptCache implements IPromptCache {
  constructor(private readonly redis: Redis) {}

  async getResponse(key: string): Promise<CoachResponse | null> {
    try {
      const raw = await this.redis.get(KEYS.response(key));
      return raw ? (JSON.parse(raw) as CoachResponse) : null;
    } catch (err) {
      log.warn({ err }, 'cache read failed — treating as miss');
      return null;
    }
  }

  async setResponse(key: string, value: CoachResponse): Promise<void> {
    try {
      await this.redis.set(
        KEYS.response(key),
        JSON.stringify(value),
        'EX',
        CACHE.RESPONSE_TTL_SECONDS,
      );
    } catch (err) {
      log.warn({ err }, 'cache write failed — ignoring');
    }
  }

  async recordHit(): Promise<void> {
    await this.redis.hincrby(KEYS.metrics, 'hits', 1).catch(() => undefined);
  }
  async recordMiss(): Promise<void> {
    await this.redis.hincrby(KEYS.metrics, 'misses', 1).catch(() => undefined);
  }

  async hitRatio(): Promise<{ hits: number; misses: number; ratio: number }> {
    const m = await this.redis.hgetall(KEYS.metrics).catch(() => ({}) as Record<string, string>);
    const hits = Number(m.hits ?? 0);
    const misses = Number(m.misses ?? 0);
    const total = hits + misses;
    return { hits, misses, ratio: total === 0 ? 0 : hits / total };
  }
}
