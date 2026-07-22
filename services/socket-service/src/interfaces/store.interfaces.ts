import type { Participant, PresenceState, Room, RoomType } from '../types/domain.types.js';

/**
 * Persistence contracts. Managers depend on these interfaces, not on
 * ioredis — so state can live in Redis in production (shared across
 * all nodes, which is what makes horizontal scaling correct) and in
 * an in-memory fake in tests, with zero manager changes.
 *
 * Why Redis and not in-process maps: with 50k connections spread over
 * many Socket.IO nodes, room membership and presence MUST be shared
 * state. A room created on node A has to be joinable on node B. The
 * Redis adapter broadcasts the *messages*; these stores hold the
 * *authoritative room/presence data* the messages are about.
 */
export interface IRoomStore {
  create(room: Room): Promise<void>;
  get(roomId: string): Promise<Room | null>;
  delete(roomId: string): Promise<void>;
  addMember(roomId: string, userId: string): Promise<number>;
  removeMember(roomId: string, userId: string): Promise<number>;
  memberCount(roomId: string): Promise<number>;
  setOwner(roomId: string, ownerId: string): Promise<void>;
}

export interface IPresenceStore {
  set(roomId: string, participant: Participant): Promise<void>;
  update(
    roomId: string,
    userId: string,
    patch: Partial<Pick<Participant, 'state' | 'typing' | 'focused' | 'cursor'>>,
  ): Promise<Participant | null>;
  get(roomId: string, userId: string): Promise<Participant | null>;
  list(roomId: string): Promise<Participant[]>;
  remove(roomId: string, userId: string): Promise<void>;
}

/**
 * Tracks how many live sockets a user has, atomically and cross-node,
 * for the connection-limit security control.
 */
export interface IConnectionRegistry {
  add(userId: string, socketId: string): Promise<number>;
  remove(userId: string, socketId: string): Promise<number>;
  count(userId: string): Promise<number>;
}

export interface CreateRoomInput {
  id: string;
  type: RoomType;
  ownerId: string;
  capacity: number;
}

export const _presenceStateValues: PresenceState[] = ['online', 'idle', 'offline'];
