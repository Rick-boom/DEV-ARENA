import type { Redis } from 'ioredis';
import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import type { ILeaderboardStore } from '../interfaces/matchmaking.interfaces.js';
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
} from '../types/matchmaking.types.js';

const { KEYS } = MM_CONSTANTS;

/**
 * Leaderboards on Redis SORTED SETS. A leaderboard is exactly "millions
 * of members ordered by score, with fast rank + fast page reads" —
 * which is the textbook ZSET use case:
 *
 *  • ZADD           — O(log N) upsert on every rating change.
 *  • ZREVRANK       — a user's rank in O(log N) (no full scan).
 *  • ZREVRANGE ... WITHSCORES — one page of the board in O(log N + page).
 *  • ZCARD          — total size in O(1).
 *
 * One ZSET per (scope, group, period), e.g. lb:COUNTRY:US:WEEKLY. The
 * FRIENDS board is derived per-request from the GLOBAL board over the
 * caller's friend id set (no ZSET is maintained per friendship graph,
 * which would be unbounded).
 */
export class RedisLeaderboardStore implements ILeaderboardStore {
  constructor(private readonly redis: Redis) {}

  async upsertScore(
    scope: LeaderboardScope,
    group: string,
    period: LeaderboardPeriod,
    userId: string,
    score: number,
  ): Promise<void> {
    await this.redis.zadd(KEYS.board(scope, group, period), score, userId);
  }

  async page(
    scope: LeaderboardScope,
    group: string,
    period: LeaderboardPeriod,
    offset: number,
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    const key = KEYS.board(scope, group, period);
    const raw = await this.redis.zrevrange(key, offset, offset + limit - 1, 'WITHSCORES');
    return this.parse(raw, offset);
  }

  async rankOf(
    scope: LeaderboardScope,
    group: string,
    period: LeaderboardPeriod,
    userId: string,
  ): Promise<{ rank: number; score: number } | null> {
    const key = KEYS.board(scope, group, period);
    const [rank, score] = await Promise.all([
      this.redis.zrevrank(key, userId),
      this.redis.zscore(key, userId),
    ]);
    if (rank === null || score === null) return null;
    return { rank: rank + 1, score: Number(score) };
  }

  async count(scope: LeaderboardScope, group: string, period: LeaderboardPeriod): Promise<number> {
    return this.redis.zcard(KEYS.board(scope, group, period));
  }

  async subsetPage(
    scope: LeaderboardScope,
    group: string,
    period: LeaderboardPeriod,
    userIds: string[],
    offset: number,
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    if (userIds.length === 0) return [];
    const key = KEYS.board(scope, group, period);
    // Fetch each friend's score, sort, then paginate. For friend-sized
    // sets (tens–hundreds) this is cheaper than materializing a ZSET.
    const pipe = this.redis.pipeline();
    userIds.forEach((id) => pipe.zscore(key, id));
    const results = await pipe.exec();
    const scored = userIds
      .map((id, i) => ({ userId: id, score: Number(results?.[i]?.[1] ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(offset, offset + limit);
    return scored.map((s, i) => ({ userId: s.userId, rank: offset + i + 1, score: s.score }));
  }

  private parse(raw: string[], offset: number): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ userId: raw[i]!, score: Number(raw[i + 1]), rank: offset + i / 2 + 1 });
    }
    return entries;
  }
}
