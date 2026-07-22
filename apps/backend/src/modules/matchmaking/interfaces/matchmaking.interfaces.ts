import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
  QueueTicket,
  RatingChange,
  RatingStats,
} from '../types/matchmaking.types.js';

/**
 * Ports. The service layer depends on these, never on ioredis/Prisma
 * directly — so the Redis-heavy stores are swappable + fakeable, and
 * the Postgres reads (friends, country) sit behind one clean adapter.
 */

// ── matchmaking pool (Redis ZSET + hash + set) ─────────────────────
export interface IQueueStore {
  /** Add a ticket: pool ZSET (score=rating) + ticket hash + dedup set. Atomic. */
  enqueue(ticket: QueueTicket): Promise<void>;
  isQueued(userId: string): Promise<boolean>;
  getTicket(userId: string): Promise<QueueTicket | null>;
  /** Remove a ticket from pool + hash + dedup set. Atomic. Returns true if present. */
  dequeue(userId: string): Promise<boolean>;
  /** Candidates within [rating-window, rating+window] in a pool, excluding self. */
  candidates(
    mode: string,
    region: string,
    rating: number,
    window: number,
    excludeUserId: string,
  ): Promise<QueueTicket[]>;
  /** All waiting tickets in a pool (for the sweep). */
  poolTickets(mode: string, region: string): Promise<QueueTicket[]>;
  /** Atomically claim a pair (both removed) — returns false if either was already taken. */
  claimPair(a: string, b: string): Promise<boolean>;
  activePools(): Promise<{ mode: string; region: string }[]>;
}

// ── leaderboards (Redis ZSET) ──────────────────────────────────────
export interface ILeaderboardStore {
  upsertScore(
    scope: LeaderboardScope,
    group: string,
    period: LeaderboardPeriod,
    userId: string,
    score: number,
  ): Promise<void>;
  page(
    scope: LeaderboardScope,
    group: string,
    period: LeaderboardPeriod,
    offset: number,
    limit: number,
  ): Promise<LeaderboardEntry[]>;
  rankOf(
    scope: LeaderboardScope,
    group: string,
    period: LeaderboardPeriod,
    userId: string,
  ): Promise<{ rank: number; score: number } | null>;
  count(scope: LeaderboardScope, group: string, period: LeaderboardPeriod): Promise<number>;
  /** Build a friends board on the fly from a set of userIds (ZSET intersection style). */
  subsetPage(
    scope: LeaderboardScope,
    group: string,
    period: LeaderboardPeriod,
    userIds: string[],
    offset: number,
    limit: number,
  ): Promise<LeaderboardEntry[]>;
}

// ── rating stats (Redis HASH + STREAM) ─────────────────────────────
export interface IRatingStore {
  getStats(userId: string): Promise<RatingStats>;
  applyResult(update: {
    userId: string;
    newRating: number;
    won: boolean;
    draw: boolean;
  }): Promise<RatingStats>;
  appendHistory(change: RatingChange): Promise<void>;
  historyStream(userId: string, limit: number): Promise<RatingChange[]>;
}

// ── presence (Redis SET) ───────────────────────────────────────────
export interface IPresenceStore {
  markOnline(userId: string): Promise<void>;
  markOffline(userId: string): Promise<void>;
  isOnline(userId: string): Promise<boolean>;
  onlineCount(): Promise<number>;
  pushReconnect(userId: string, payload: unknown): Promise<void>;
  drainReconnect(userId: string): Promise<unknown[]>;
}

// ── outbound ports (assumed external services) ─────────────────────
export interface IUserDirectory {
  getRating(userId: string): Promise<number>;
  getCountry(userId: string): Promise<string | null>;
  getCollege(userId: string): Promise<string | null>;
  getFriendIds(userId: string): Promise<string[]>;
  /** Persist a durable leaderboard snapshot + rating history (Postgres). */
  persistRatingHistory(change: RatingChange): Promise<void>;
}

export interface IBattleGateway {
  /** Create a battle for a matched pair (Battle Engine assumed to exist). */
  createBattle(input: {
    players: string[];
    mode: string;
    rated: boolean;
  }): Promise<{ battleId: string }>;
}

export interface IMatchPublisher {
  emitToUser(userId: string, event: string, payload: unknown): void;
  /** cross-node broadcast via Redis pub/sub */
  broadcast(event: string, payload: unknown): void;
}

export interface IRateLimiter {
  hit(key: string, windowMs: number, max: number): Promise<boolean>;
}
