import type { Redis } from 'ioredis';
import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import type { IRatingStore } from '../interfaces/matchmaking.interfaces.js';
import type { RatingChange, RatingStats } from '../types/matchmaking.types.js';

const { KEYS, RATING, STREAMS } = MM_CONSTANTS;

/**
 * Live rating + streak stats. Two Redis structures:
 *
 *  • HASH  `rating:{userId}` — one round-trip HGETALL for a user's full
 *    stat block; HINCRBY makes streak/game bumps atomic without a
 *    read-modify-write race. This is the hot read on every profile and
 *    every match, so it must be a single O(1) op.
 *  • STREAM `rating:events` — append-only, ordered, CAPPED (MAXLEN) log
 *    of every rating change. A Stream (not a List) because multiple
 *    independent consumers — the leaderboard updater, analytics, the
 *    durable-history writer — each read it with their own cursor via
 *    consumer groups, and entries are ID-addressable for replay.
 */
export class RedisRatingStore implements IRatingStore {
  constructor(private readonly redis: Redis) {}

  async getStats(userId: string): Promise<RatingStats> {
    const h = await this.redis.hgetall(KEYS.ratingStats(userId));
    return {
      userId,
      current: Number(h.current ?? RATING.DEFAULT),
      peak: Number(h.peak ?? RATING.DEFAULT),
      games: Number(h.games ?? 0),
      wins: Number(h.wins ?? 0),
      losses: Number(h.losses ?? 0),
      winStreak: Number(h.winStreak ?? 0),
      lossStreak: Number(h.lossStreak ?? 0),
    };
  }

  async applyResult(update: {
    userId: string;
    newRating: number;
    won: boolean;
    draw: boolean;
  }): Promise<RatingStats> {
    const key = KEYS.ratingStats(update.userId);
    const current = await this.getStats(update.userId);
    const winStreak = update.won ? current.winStreak + 1 : 0;
    const lossStreak = !update.won && !update.draw ? current.lossStreak + 1 : 0;
    const peak = Math.max(current.peak, update.newRating);

    const next: RatingStats = {
      userId: update.userId,
      current: update.newRating,
      peak,
      games: current.games + 1,
      wins: current.wins + (update.won ? 1 : 0),
      losses: current.losses + (!update.won && !update.draw ? 1 : 0),
      winStreak,
      lossStreak,
    };
    await this.redis.hset(key, {
      current: String(next.current),
      peak: String(next.peak),
      games: String(next.games),
      wins: String(next.wins),
      losses: String(next.losses),
      winStreak: String(next.winStreak),
      lossStreak: String(next.lossStreak),
    });
    return next;
  }

  async appendHistory(change: RatingChange): Promise<void> {
    await this.redis.xadd(
      KEYS.ratingStream,
      'MAXLEN',
      '~',
      String(STREAMS.MAXLEN),
      '*',
      'userId',
      change.userId,
      'old',
      String(change.oldRating),
      'new',
      String(change.newRating),
      'change',
      String(change.change),
      'reason',
      change.reason,
      'battleId',
      change.battleId ?? '',
      'at',
      String(change.at),
    );
  }

  async historyStream(userId: string, limit: number): Promise<RatingChange[]> {
    // Read newest-first, filter to this user. For deep history the durable
    // Postgres table (via IUserDirectory) is the paginated source; the
    // stream is the fast recent-window view.
    const entries = await this.redis.xrevrange(KEYS.ratingStream, '+', '-', 'COUNT', limit * 5);
    const changes: RatingChange[] = [];
    for (const [, fields] of entries) {
      const map = this.fieldsToObject(fields);
      if (map.userId !== userId) continue;
      changes.push({
        userId,
        oldRating: Number(map.old),
        newRating: Number(map.new),
        change: Number(map.change),
        reason: map.reason ?? 'battle',
        battleId: map.battleId || undefined,
        at: Number(map.at),
      });
      if (changes.length >= limit) break;
    }
    return changes;
  }

  private fieldsToObject(fields: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) obj[fields[i]!] = fields[i + 1]!;
    return obj;
  }
}
