import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { REDIS_KEYS } from '../constants/rooms.js';
import type { IPresenceStore } from '../interfaces/store.interfaces.js';
import type { Participant } from '../types/domain.types.js';

/**
 * Redis-backed presence. One hash per room, field = userId, value =
 * JSON participant. Reads/writes are single field ops so concurrent
 * presence updates from different nodes don't clobber each other's
 * unrelated fields. The whole hash expires with its room's TTL.
 */
export class RedisPresenceStore implements IPresenceStore {
  constructor(private readonly redis: Redis) {}

  async set(roomId: string, participant: Participant): Promise<void> {
    const key = REDIS_KEYS.presence(roomId);
    await this.redis.hset(key, participant.userId, JSON.stringify(participant));
    await this.redis.expire(key, env.ROOM_TTL_SECONDS);
  }

  async update(
    roomId: string,
    userId: string,
    patch: Partial<Pick<Participant, 'state' | 'typing' | 'focused' | 'cursor'>>,
  ): Promise<Participant | null> {
    const existing = await this.get(roomId, userId);
    if (!existing) return null;
    const next: Participant = { ...existing, ...patch };
    await this.redis.hset(REDIS_KEYS.presence(roomId), userId, JSON.stringify(next));
    return next;
  }

  async get(roomId: string, userId: string): Promise<Participant | null> {
    const raw = await this.redis.hget(REDIS_KEYS.presence(roomId), userId);
    return raw ? (JSON.parse(raw) as Participant) : null;
  }

  async list(roomId: string): Promise<Participant[]> {
    const all = await this.redis.hgetall(REDIS_KEYS.presence(roomId));
    return Object.values(all).map((raw) => JSON.parse(raw) as Participant);
  }

  async remove(roomId: string, userId: string): Promise<void> {
    await this.redis.hdel(REDIS_KEYS.presence(roomId), userId);
  }
}
