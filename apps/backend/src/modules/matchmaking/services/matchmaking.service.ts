import { randomUUID } from 'node:crypto';
import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import {
  AlreadyQueuedError,
  InvalidQueueError,
  NotQueuedError,
  RateLimitedError,
} from '../errors/matchmaking-error.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type {
  IBattleGateway,
  IMatchPublisher,
  IPresenceStore,
  IQueueStore,
  IRateLimiter,
  IUserDirectory,
} from '../interfaces/matchmaking.interfaces.js';
import type { Region } from '../types/matchmaking.types.js';
import {
  MatchMode,
  SkillPreference,
  type Match,
  type QueueTicket,
} from '../types/matchmaking.types.js';

const log = createModuleLogger('matchmaking-service');
const { KEYS, QUEUE, RATE_LIMIT } = MM_CONSTANTS;

interface JoinInput {
  userId: string;
  mode: MatchMode;
  region: Region;
  language: string;
  skill: SkillPreference;
  friendId?: string;
  privateCode?: string;
}

/**
 * Matchmaking use cases. Owns queue admission (dup + rate-limit),
 * cancellation, and the pairing algorithm invoked by the sweep worker.
 * The pairing itself is a widening rating-window search: fair when the
 * pool is dense, guaranteed to match eventually as the window grows.
 */
export class MatchmakingService {
  constructor(
    private readonly queue: IQueueStore,
    private readonly presence: IPresenceStore,
    private readonly users: IUserDirectory,
    private readonly battles: IBattleGateway,
    private readonly publisher: IMatchPublisher,
    private readonly rateLimiter: IRateLimiter,
  ) {}

  // ── join ───────────────────────────────────────────────────────
  async join(input: JoinInput): Promise<{ ticket: QueueTicket }> {
    const ok = await this.rateLimiter.hit(
      KEYS.joinRate(input.userId),
      RATE_LIMIT.JOIN_WINDOW_MS,
      RATE_LIMIT.JOIN_MAX,
    );
    if (!ok) throw new RateLimitedError();

    if (await this.queue.isQueued(input.userId)) throw new AlreadyQueuedError();
    if (input.friendId && input.friendId === input.userId) {
      throw new InvalidQueueError('Cannot friend-match yourself');
    }

    const rating = await this.users.getRating(input.userId);
    const ticket: QueueTicket = {
      userId: input.userId,
      rating,
      mode: input.mode,
      region: input.region,
      language: input.language,
      skill: input.skill,
      friendId: input.friendId,
      privateCode: input.privateCode,
      enqueuedAt: Date.now(),
    };
    await this.queue.enqueue(ticket);
    await this.presence.markOnline(input.userId);
    this.publisher.emitToUser(input.userId, 'queue:join', { ticket });
    log.info({ userId: input.userId, mode: input.mode, rating }, 'joined queue');

    // Friend match: try to pair immediately if the friend is already waiting.
    if (input.friendId) await this.tryFriendMatch(ticket, input.friendId);
    return { ticket };
  }

  // ── leave ──────────────────────────────────────────────────────
  async leave(userId: string): Promise<void> {
    const removed = await this.queue.dequeue(userId);
    if (!removed) throw new NotQueuedError();
    this.publisher.emitToUser(userId, 'queue:leave', { userId });
    log.info({ userId }, 'left queue');
  }

  // ── status / reconnect ─────────────────────────────────────────
  async status(userId: string): Promise<{ queued: boolean; ticket: QueueTicket | null }> {
    const ticket = await this.queue.getTicket(userId);
    return { queued: ticket !== null, ticket };
  }

  /** On reconnect, flush any match handoffs missed while offline. */
  async reconnect(userId: string): Promise<{ pending: unknown[] }> {
    await this.presence.markOnline(userId);
    const pending = await this.presence.drainReconnect(userId);
    for (const p of pending) this.publisher.emitToUser(userId, 'match:found', p);
    return { pending };
  }

  // ── the pairing sweep (called by the worker each tick) ─────────
  async sweep(): Promise<number> {
    const pools = await this.queue.activePools();
    let matched = 0;
    for (const { mode, region } of pools) {
      matched += await this.sweepPool(mode, region);
    }
    return matched;
  }

  private async sweepPool(mode: string, region: string): Promise<number> {
    const tickets = await this.queue.poolTickets(mode, region);
    // Oldest first — longest-waiting players get first pick (starvation-free).
    tickets.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

    const paired = new Set<string>();
    let count = 0;
    for (const ticket of tickets) {
      if (paired.has(ticket.userId)) continue;
      // Timeout: evict tickets that have waited past the ceiling.
      if (Date.now() - ticket.enqueuedAt > QUEUE.TIMEOUT_SECONDS * 1000) {
        await this.queue.dequeue(ticket.userId);
        this.publisher.emitToUser(ticket.userId, 'queue:timeout', { userId: ticket.userId });
        continue;
      }
      const window = this.windowFor(ticket);
      const candidates = await this.queue.candidates(
        mode,
        region,
        ticket.rating,
        window,
        ticket.userId,
      );
      const opponent = candidates.find((c) => !paired.has(c.userId) && this.compatible(ticket, c));
      if (!opponent) continue;

      const claimed = await this.queue.claimPair(ticket.userId, opponent.userId);
      if (!claimed) continue;
      paired.add(ticket.userId);
      paired.add(opponent.userId);
      await this.createMatch(ticket, opponent);
      count += 1;
    }
    return count;
  }

  /** Rating window widens with wait time so a match is fair early, certain late. */
  private windowFor(ticket: QueueTicket): number {
    const waitedSec = (Date.now() - ticket.enqueuedAt) / 1000;
    const grown = QUEUE.BASE_WINDOW + waitedSec * QUEUE.WINDOW_GROWTH_PER_SEC;
    const skillMultiplier = ticket.skill === SkillPreference.SIMILAR ? 0.5 : 1;
    return Math.min(QUEUE.MAX_WINDOW, grown * skillMultiplier);
  }

  private compatible(a: QueueTicket, b: QueueTicket): boolean {
    if (a.mode !== b.mode || a.region !== b.region) return false;
    // Private/friend tickets only pair with their intended counterpart.
    if (a.friendId && a.friendId !== b.userId) return false;
    if (b.friendId && b.friendId !== a.userId) return false;
    if (a.privateCode || b.privateCode) return a.privateCode === b.privateCode;
    return true;
  }

  private async tryFriendMatch(ticket: QueueTicket, friendId: string): Promise<void> {
    const friend = await this.queue.getTicket(friendId);
    if (!friend || !this.compatible(ticket, friend)) return;
    if (await this.queue.claimPair(ticket.userId, friendId)) {
      await this.createMatch(ticket, friend);
    }
  }

  private async createMatch(a: QueueTicket, b: QueueTicket): Promise<void> {
    const { battleId } = await this.battles.createBattle({
      players: [a.userId, b.userId],
      mode: a.mode,
      rated: a.mode !== MatchMode.PRACTICE,
    });
    const match: Match = {
      matchId: randomUUID(),
      battleId,
      mode: a.mode,
      region: a.region,
      players: [a.userId, b.userId],
      createdAt: Date.now(),
    };
    // Deliver to both; queue a reconnect copy in case one is mid-blip.
    for (const userId of match.players) {
      const online = await this.presence.isOnline(userId);
      if (online) this.publisher.emitToUser(userId, 'match:found', match);
      else await this.presence.pushReconnect(userId, match);
    }
    this.publisher.broadcast('match:found', match);
    log.info({ matchId: match.matchId, players: match.players, battleId }, 'match created');
  }
}
