import { RoomType } from '../types/domain.types.js';
import { env } from '../config/env.js';

/** Per-type room capacity, resolved once from config. */
export const ROOM_CAPACITY: Record<RoomType, number> = {
  [RoomType.BATTLE]: env.BATTLE_ROOM_CAPACITY,
  [RoomType.COLLABORATION]: env.COLLAB_ROOM_CAPACITY,
  [RoomType.INTERVIEW]: env.INTERVIEW_ROOM_CAPACITY,
};

/** Redis key builders — one namespace so keys are greppable + evictable. */
export const REDIS_KEYS = {
  room: (roomId: string) => `socket:room:${roomId}`,
  roomMembers: (roomId: string) => `socket:room:${roomId}:members`,
  userConnections: (userId: string) => `socket:user:${userId}:conns`,
  presence: (roomId: string) => `socket:room:${roomId}:presence`,
} as const;

/** Socket.IO room name for a domain room (namespaced to avoid clashes). */
export const ioRoomName = (roomId: string): string => `room:${roomId}`;
