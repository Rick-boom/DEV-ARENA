import type { Redis } from 'ioredis';
import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IQueueStore } from '../interfaces/matchmaking.interfaces.js';
import type { QueueTicket } from '../types/matchmaking.types.js';

const log = createModuleLogger('mm-queue-store');
const { KEYS, QUEUE } = MM_CONSTANTS;

/**
 * The matchmaking pool. THREE Redis structures, each chosen for the
 * exact access pattern:
 *
 *  • ZSET  `mm:pool:{mode}:{region}`  — score = rating. Matchmaking is
 *    fundamentally "find someone near my rating", which is a sorted
 *    range query. ZRANGEBYSCORE returns opponents inside a rating
 *    window in O(log N + k); insert/remove are O(log N). No other
 *    structure gives ranked-range lookups at this cost.
 *  • HASH  `mm:ticket:{userId}`       — the full ticket payload (mode,
 *    language, skill, timestamps). The ZSET only holds member+score;
 *    the hash holds everything else, fetched in one HGETALL.
 *  • SET   `mm:queued`                — O(1) SISMEMBER duplicate-queue
 *    protection, independent of which pool a user is in.
 *
 * enqueue/dequeue/claimPair are Lua scripts so the three structures
 * never drift under concurrency (10k simultaneous joins).
 */
export class RedisQueueStore implements IQueueStore {
  constructor(private readonly redis: Redis) {}

  async enqueue(ticket: QueueTicket): Promise<void> {
    const pool = KEYS.queuePool(ticket.mode, ticket.region);
    const lua = `
      redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
      redis.call('HSET', KEYS[2], 'data', ARGV[4])
      redis.call('EXPIRE', KEYS[2], ARGV[5])
      redis.call('SADD', KEYS[3], ARGV[3])
      redis.call('SADD', KEYS[4], KEYS[1])
      return 1`;
    await this.redis.eval(
      lua,
      4,
      pool,
      KEYS.ticket(ticket.userId),
      KEYS.queuedSet,
      'mm:pools',
      String(ticket.rating),
      ticket.userId,
      JSON.stringify(ticket),
      String(QUEUE.TIMEOUT_SECONDS),
    );
  }

  async isQueued(userId: string): Promise<boolean> {
    return (await this.redis.sismember(KEYS.queuedSet, userId)) === 1;
  }

  async getTicket(userId: string): Promise<QueueTicket | null> {
    const raw = await this.redis.hget(KEYS.ticket(userId), 'data');
    return raw ? (JSON.parse(raw) as QueueTicket) : null;
  }

  async dequeue(userId: string): Promise<boolean> {
    const ticket = await this.getTicket(userId);
    if (!ticket) {
      // Best-effort cleanup of the dedup set even if the hash expired.
      await this.redis.srem(KEYS.queuedSet, userId);
      return false;
    }
    const pool = KEYS.queuePool(ticket.mode, ticket.region);
    const lua = `
      redis.call('ZREM', KEYS[1], ARGV[1])
      redis.call('DEL', KEYS[2])
      redis.call('SREM', KEYS[3], ARGV[1])
      return 1`;
    await this.redis.eval(lua, 3, pool, KEYS.ticket(userId), KEYS.queuedSet, userId);
    return true;
  }

  async candidates(
    mode: string,
    region: string,
    rating: number,
    window: number,
    excludeUserId: string,
  ): Promise<QueueTicket[]> {
    const pool = KEYS.queuePool(mode, region);
    const ids = await this.redis.zrangebyscore(pool, rating - window, rating + window);
    const tickets = await this.hydrate(ids.filter((id) => id !== excludeUserId));
    // Nearest-rating-first ordering makes the fairest pairing greedy-optimal.
    return tickets.sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating));
  }

  async poolTickets(mode: string, region: string): Promise<QueueTicket[]> {
    const ids = await this.redis.zrange(KEYS.queuePool(mode, region), 0, -1);
    return this.hydrate(ids);
  }

  private async hydrate(ids: string[]): Promise<QueueTicket[]> {
    if (ids.length === 0) return [];
    const pipe = this.redis.pipeline();
    ids.forEach((id) => pipe.hget(KEYS.ticket(id), 'data'));
    const results = await pipe.exec();
    const tickets: QueueTicket[] = [];
    for (const [, raw] of results ?? []) {
      if (typeof raw === 'string') tickets.push(JSON.parse(raw) as QueueTicket);
    }
    return tickets;
  }

  async claimPair(a: string, b: string): Promise<boolean> {
    // Atomically claim both users: succeeds only if BOTH are still queued,
    // so two matcher passes can't double-book a player.
    const lua = `
      if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1
         and redis.call('SISMEMBER', KEYS[1], ARGV[2]) == 1 then
        redis.call('SREM', KEYS[1], ARGV[1], ARGV[2])
        return 1
      end
      return 0`;
    const claimed = (await this.redis.eval(lua, 1, KEYS.queuedSet, a, b)) as number;
    if (claimed !== 1) return false;
    // Now remove their ZSET entries + hashes (order after the claim so the
    // dedup set is the single point of truth for "already matched").
    const ta = await this.getTicket(a);
    const tb = await this.getTicket(b);
    const pipe = this.redis.pipeline();
    if (ta) pipe.zrem(KEYS.queuePool(ta.mode, ta.region), a).del(KEYS.ticket(a));
    if (tb) pipe.zrem(KEYS.queuePool(tb.mode, tb.region), b).del(KEYS.ticket(b));
    await pipe.exec();
    log.debug({ a, b }, 'pair claimed');
    return true;
  }

  async activePools(): Promise<{ mode: string; region: string }[]> {
    const pools = await this.redis.smembers('mm:pools');
    return pools
      .map((p) => p.replace('mm:pool:', '').split(':'))
      .filter((parts) => parts.length === 2)
      .map(([mode, region]) => ({ mode: mode!, region: region! }));
  }
}
