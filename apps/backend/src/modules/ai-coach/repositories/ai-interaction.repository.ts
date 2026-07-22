import type { Redis } from 'ioredis';
import { AI_CONSTANTS } from '../constants/ai.constants.js';
import type { IAiInteractionRepository } from '../interfaces/ai.interfaces.js';
import type { InteractionRecord } from '../types/ai.types.js';

const { KEYS, CACHE } = AI_CONSTANTS;

/**
 * Interaction history as a capped Redis LIST per user — no schema
 * migration, O(1) append, and naturally bounded (LTRIM). Powers
 * GET /ai/history and the prompt/latency/token logs. A durable analytics
 * sink is out of scope (the prompt excludes Analytics); this is the
 * user-facing recent history.
 */
export class RedisAiInteractionRepository implements IAiInteractionRepository {
  constructor(private readonly redis: Redis) {}

  async append(userId: string, record: InteractionRecord): Promise<void> {
    const key = KEYS.history(userId);
    await this.redis
      .multi()
      .lpush(key, JSON.stringify(record))
      .ltrim(key, 0, CACHE.HISTORY_MAX - 1)
      .expire(key, CACHE.HISTORY_TTL_SECONDS)
      .exec();
  }

  async list(userId: string, limit: number): Promise<InteractionRecord[]> {
    const raw = await this.redis.lrange(KEYS.history(userId), 0, limit - 1);
    return raw.map((r) => JSON.parse(r) as InteractionRecord);
  }
}
