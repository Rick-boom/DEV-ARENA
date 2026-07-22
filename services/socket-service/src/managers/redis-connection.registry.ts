import type { Redis } from 'ioredis';
import { REDIS_KEYS } from '../constants/rooms.js';
import type { IConnectionRegistry } from '../interfaces/store.interfaces.js';

/**
 * Cross-node connection registry. A user's live socket ids are a
 * Redis SET, so the connection-limit check is correct even when a
 * user's tabs land on different Socket.IO nodes. SADD/SREM return the
 * new cardinality atomically — no read-modify-write race.
 */
export class RedisConnectionRegistry implements IConnectionRegistry {
  constructor(private readonly redis: Redis) {}

  async add(userId: string, socketId: string): Promise<number> {
    const key = REDIS_KEYS.userConnections(userId);
    await this.redis.sadd(key, socketId);
    await this.redis.expire(key, 86_400);
    return this.redis.scard(key);
  }

  async remove(userId: string, socketId: string): Promise<number> {
    const key = REDIS_KEYS.userConnections(userId);
    await this.redis.srem(key, socketId);
    return this.redis.scard(key);
  }

  async count(userId: string): Promise<number> {
    return this.redis.scard(REDIS_KEYS.userConnections(userId));
  }
}
