import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { REDIS_KEYS } from '../constants/rooms.js';
import type { IRoomStore } from '../interfaces/store.interfaces.js';
import type { Room } from '../types/domain.types.js';

/**
 * Redis-backed room store. Room metadata is a hash; membership is a
 * SET (so add/remove are atomic and idempotent, and count is O(1)).
 * Every key carries a TTL so a crashed node can never leak a room
 * forever — the room self-expires if nothing touches it.
 */
export class RedisRoomStore implements IRoomStore {
  constructor(private readonly redis: Redis) {}

  async create(room: Room): Promise<void> {
    const key = REDIS_KEYS.room(room.id);
    await this.redis
      .multi()
      .hset(key, {
        id: room.id,
        type: room.type,
        ownerId: room.ownerId,
        capacity: String(room.capacity),
        createdAt: String(room.createdAt),
      })
      .expire(key, env.ROOM_TTL_SECONDS)
      .exec();
  }

  async get(roomId: string): Promise<Room | null> {
    const data = await this.redis.hgetall(REDIS_KEYS.room(roomId));
    if (!data.id || !data.type || !data.ownerId) return null;
    const memberIds = await this.redis.smembers(REDIS_KEYS.roomMembers(roomId));
    return {
      id: data.id,
      type: data.type as Room['type'],
      ownerId: data.ownerId,
      capacity: Number(data.capacity ?? 0),
      createdAt: Number(data.createdAt ?? 0),
      memberIds,
    };
  }

  async delete(roomId: string): Promise<void> {
    await this.redis.del(
      REDIS_KEYS.room(roomId),
      REDIS_KEYS.roomMembers(roomId),
      REDIS_KEYS.presence(roomId),
    );
  }

  async addMember(roomId: string, userId: string): Promise<number> {
    const membersKey = REDIS_KEYS.roomMembers(roomId);
    await this.redis.sadd(membersKey, userId);
    await this.redis.expire(membersKey, env.ROOM_TTL_SECONDS);
    return this.redis.scard(membersKey);
  }

  async removeMember(roomId: string, userId: string): Promise<number> {
    const membersKey = REDIS_KEYS.roomMembers(roomId);
    await this.redis.srem(membersKey, userId);
    return this.redis.scard(membersKey);
  }

  async memberCount(roomId: string): Promise<number> {
    return this.redis.scard(REDIS_KEYS.roomMembers(roomId));
  }

  async setOwner(roomId: string, ownerId: string): Promise<void> {
    await this.redis.hset(REDIS_KEYS.room(roomId), 'ownerId', ownerId);
  }
}
