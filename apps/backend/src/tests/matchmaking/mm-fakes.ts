import type {
  IBattleGateway,
  ILeaderboardStore,
  IMatchPublisher,
  IPresenceStore,
  IQueueStore,
  IRateLimiter,
  IRatingStore,
  IUserDirectory,
} from '../../modules/matchmaking/interfaces/matchmaking.interfaces.js';
import { MM_CONSTANTS } from '../../modules/matchmaking/constants/matchmaking.constants.js';
import type {
  LeaderboardEntry,
  QueueTicket,
  RatingChange,
  RatingStats,
} from '../../modules/matchmaking/types/matchmaking.types.js';

/** In-memory fakes so the whole service is testable without Redis/Prisma. */

export class FakeQueueStore implements IQueueStore {
  tickets = new Map<string, QueueTicket>();
  claimed = new Set<string>();

  async enqueue(t: QueueTicket) {
    this.tickets.set(t.userId, t);
  }
  async isQueued(userId: string) {
    return this.tickets.has(userId);
  }
  async getTicket(userId: string) {
    return this.tickets.get(userId) ?? null;
  }
  async dequeue(userId: string) {
    return this.tickets.delete(userId);
  }
  async candidates(mode: string, region: string, rating: number, window: number, exclude: string) {
    return [...this.tickets.values()]
      .filter(
        (t) =>
          t.userId !== exclude &&
          t.mode === mode &&
          t.region === region &&
          Math.abs(t.rating - rating) <= window,
      )
      .sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating));
  }
  async poolTickets(mode: string, region: string) {
    return [...this.tickets.values()].filter((t) => t.mode === mode && t.region === region);
  }
  async claimPair(a: string, b: string) {
    if (this.claimed.has(a) || this.claimed.has(b)) return false;
    if (!this.tickets.has(a) || !this.tickets.has(b)) return false;
    this.claimed.add(a);
    this.claimed.add(b);
    this.tickets.delete(a);
    this.tickets.delete(b);
    return true;
  }
  async activePools() {
    const set = new Set<string>();
    for (const t of this.tickets.values()) set.add(`${t.mode}:${t.region}`);
    return [...set].map((s) => {
      const [mode, region] = s.split(':');
      return { mode: mode!, region: region! };
    });
  }
}

export class FakePresenceStore implements IPresenceStore {
  online = new Set<string>();
  reconnects = new Map<string, unknown[]>();
  async markOnline(u: string) {
    this.online.add(u);
  }
  async markOffline(u: string) {
    this.online.delete(u);
  }
  async isOnline(u: string) {
    return this.online.has(u);
  }
  async onlineCount() {
    return this.online.size;
  }
  async pushReconnect(u: string, p: unknown) {
    if (!this.reconnects.has(u)) this.reconnects.set(u, []);
    this.reconnects.get(u)!.push(p);
  }
  async drainReconnect(u: string) {
    const items = this.reconnects.get(u) ?? [];
    this.reconnects.delete(u);
    return items;
  }
}

export class FakeUserDirectory implements IUserDirectory {
  ratings = new Map<string, number>();
  countries = new Map<string, string>();
  friends = new Map<string, string[]>();
  persisted: RatingChange[] = [];
  async getRating(u: string) {
    return this.ratings.get(u) ?? MM_CONSTANTS.RATING.DEFAULT;
  }
  async getCountry(u: string) {
    return this.countries.get(u) ?? null;
  }
  async getCollege() {
    return null;
  }
  async getFriendIds(u: string) {
    return this.friends.get(u) ?? [];
  }
  async persistRatingHistory(c: RatingChange) {
    this.persisted.push(c);
  }
}

export class FakeBattleGateway implements IBattleGateway {
  created: { players: string[]; mode: string; rated: boolean }[] = [];
  async createBattle(input: { players: string[]; mode: string; rated: boolean }) {
    this.created.push(input);
    return { battleId: `battle-${this.created.length}` };
  }
}

export class FakePublisher implements IMatchPublisher {
  toUser: { userId: string; event: string; payload: unknown }[] = [];
  broadcasts: { event: string; payload: unknown }[] = [];
  emitToUser(userId: string, event: string, payload: unknown) {
    this.toUser.push({ userId, event, payload });
  }
  broadcast(event: string, payload: unknown) {
    this.broadcasts.push({ event, payload });
  }
  eventsFor(userId: string, event: string) {
    return this.toUser.filter((e) => e.userId === userId && e.event === event);
  }
}

export class FakeRateLimiter implements IRateLimiter {
  counts = new Map<string, number>();
  async hit(key: string, _windowMs: number, max: number) {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n <= max;
  }
}

export class FakeRatingStore implements IRatingStore {
  stats = new Map<string, RatingStats>();
  history: RatingChange[] = [];
  async getStats(userId: string): Promise<RatingStats> {
    return (
      this.stats.get(userId) ?? {
        userId,
        current: MM_CONSTANTS.RATING.DEFAULT,
        peak: MM_CONSTANTS.RATING.DEFAULT,
        games: 0,
        wins: 0,
        losses: 0,
        winStreak: 0,
        lossStreak: 0,
      }
    );
  }
  async applyResult(u: { userId: string; newRating: number; won: boolean; draw: boolean }) {
    const cur = await this.getStats(u.userId);
    const next: RatingStats = {
      userId: u.userId,
      current: u.newRating,
      peak: Math.max(cur.peak, u.newRating),
      games: cur.games + 1,
      wins: cur.wins + (u.won ? 1 : 0),
      losses: cur.losses + (!u.won && !u.draw ? 1 : 0),
      winStreak: u.won ? cur.winStreak + 1 : 0,
      lossStreak: !u.won && !u.draw ? cur.lossStreak + 1 : 0,
    };
    this.stats.set(u.userId, next);
    return next;
  }
  async appendHistory(c: RatingChange) {
    this.history.push(c);
  }
  async historyStream(userId: string, limit: number) {
    return this.history
      .filter((h) => h.userId === userId)
      .slice(-limit)
      .reverse();
  }
}

export class FakeLeaderboardStore implements ILeaderboardStore {
  boards = new Map<string, Map<string, number>>();
  private key(scope: string, group: string, period: string) {
    return `${scope}:${group}:${period}`;
  }
  async upsertScore(scope: string, group: string, period: string, userId: string, score: number) {
    const k = this.key(scope, group, period);
    if (!this.boards.has(k)) this.boards.set(k, new Map());
    this.boards.get(k)!.set(userId, score);
  }
  async page(
    scope: string,
    group: string,
    period: string,
    offset: number,
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    const board = this.boards.get(this.key(scope, group, period)) ?? new Map();
    return [...board.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(offset, offset + limit)
      .map(([userId, score], i) => ({ userId, score, rank: offset + i + 1 }));
  }
  async rankOf(scope: string, group: string, period: string, userId: string) {
    const board = this.boards.get(this.key(scope, group, period));
    if (!board?.has(userId)) return null;
    const sorted = [...board.entries()].sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([id]) => id === userId);
    return { rank: idx + 1, score: board.get(userId)! };
  }
  async count(scope: string, group: string, period: string) {
    return this.boards.get(this.key(scope, group, period))?.size ?? 0;
  }
  async subsetPage(
    scope: string,
    group: string,
    period: string,
    ids: string[],
    offset: number,
    limit: number,
  ) {
    const board = this.boards.get(this.key(scope, group, period)) ?? new Map();
    return ids
      .map((id) => ({ userId: id, score: Number(board.get(id) ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(offset, offset + limit)
      .map((s, i) => ({ userId: s.userId, rank: offset + i + 1, score: s.score }));
  }
}
