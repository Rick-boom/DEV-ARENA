import type { Redis } from 'ioredis';
import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import type { IPresenceStore } from '../interfaces/matchmaking.interfaces.js';

const { KEYS } = MM_CONSTANTS;

/**
 * Online presence + reconnect queue.
 *
 *  • SET  `mm:online`             — O(1) SADD/SREM/SISMEMBER for "is this
 *    user online" and SCARD for the live-user gauge. A plain set is the
 *    right structure for unordered membership at 100k users.
 *  • LIST `mm:reconnect:{userId}` — FIFO of match handoffs a user missed
 *    while briefly disconnected. When they reconnect we RPOP the backlog
 *    so a match found during a 2s network blip is still delivered
 *    (the "reconnect queue" requirement). A List (LPUSH/RPOP) is the
 *    natural durable FIFO here.
 */
export class RedisPresenceStore implements IPresenceStore {
  constructor(private readonly redis: Redis) {}

  async markOnline(userId: string): Promise<void> {
    await this.redis.sadd(KEYS.online, userId);
  }
  async markOffline(userId: string): Promise<void> {
    await this.redis.srem(KEYS.online, userId);
  }
  async isOnline(userId: string): Promise<boolean> {
    return (await this.redis.sismember(KEYS.online, userId)) === 1;
  }
  async onlineCount(): Promise<number> {
    return this.redis.scard(KEYS.online);
  }
  async pushReconnect(userId: string, payload: unknown): Promise<void> {
    const key = KEYS.reconnect(userId);
    await this.redis.lpush(key, JSON.stringify(payload));
    await this.redis.expire(key, 300); // 5-min grace window
  }
  async drainReconnect(userId: string): Promise<unknown[]> {
    const key = KEYS.reconnect(userId);
    const items = await this.redis.lrange(key, 0, -1);
    await this.redis.del(key);
    return items.map((i) => JSON.parse(i) as unknown).reverse();
  }
}
