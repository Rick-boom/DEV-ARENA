import type { Redis } from 'ioredis';
import { JUDGE_CONSTANTS } from '../constants/judge.constants.js';
import type { IDuplicateGuard, IRateLimiter, ITimeline } from '../interfaces/judge.interfaces.js';

/** Fixed-window per-user limiter (INCR + PEXPIRE); cross-node correct. */
export class RedisRateLimiter implements IRateLimiter {
  constructor(private readonly redis: Redis) {}
  async hit(key: string, windowMs: number, max: number): Promise<boolean> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.pexpire(key, windowMs);
    return count <= max;
  }
}

/**
 * Duplicate-submission guard. SET NX with a TTL: the first identical
 * (user, problem, code-hash) within the window wins; a rapid re-submit
 * of the exact same code returns false. Prevents accidental double-clicks
 * and wasteful re-judging of unchanged code.
 */
export class RedisDuplicateGuard implements IDuplicateGuard {
  constructor(private readonly redis: Redis) {}
  async checkAndSet(
    userId: string,
    problemId: string,
    codeHash: string,
    windowMs: number,
  ): Promise<boolean> {
    const key = JUDGE_CONSTANTS.KEYS.dedupe(userId, problemId, codeHash);
    const set = await this.redis.set(key, '1', 'PX', windowMs, 'NX');
    return set === 'OK';
  }
}

/**
 * Append-only judging timeline in a capped Redis list — cheap
 * observability for "what happened to submission X and when" without a
 * new table. Bounded via LTRIM; expires after a day.
 */
export class RedisTimeline implements ITimeline {
  constructor(private readonly redis: Redis) {}
  async record(
    submissionId: string,
    stage: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    const key = JUDGE_CONSTANTS.KEYS.timeline(submissionId);
    await this.redis
      .multi()
      .rpush(key, JSON.stringify({ stage, at: Date.now(), ...detail }))
      .ltrim(key, -100, -1)
      .expire(key, 24 * 3600)
      .exec();
  }
}
