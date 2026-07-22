import type {
  IConnectionRegistry,
  IPresenceStore,
  IRoomStore,
} from '../../interfaces/store.interfaces.js';
import type { Participant, Room } from '../../types/domain.types.js';

/**
 * In-memory implementations of every store interface. Because managers
 * depend on the interfaces, these fakes exercise the real manager logic
 * with zero Redis — fast, deterministic, no external service.
 */
export class FakeRoomStore implements IRoomStore {
  rooms = new Map<string, Room>();
  members = new Map<string, Set<string>>();

  async create(room: Room): Promise<void> {
    this.rooms.set(room.id, { ...room, memberIds: [] });
    this.members.set(room.id, new Set());
  }
  async get(roomId: string): Promise<Room | null> {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return { ...room, memberIds: [...(this.members.get(roomId) ?? [])] };
  }
  async delete(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    this.members.delete(roomId);
  }
  async addMember(roomId: string, userId: string): Promise<number> {
    this.members.get(roomId)?.add(userId);
    return this.members.get(roomId)?.size ?? 0;
  }
  async removeMember(roomId: string, userId: string): Promise<number> {
    this.members.get(roomId)?.delete(userId);
    return this.members.get(roomId)?.size ?? 0;
  }
  async memberCount(roomId: string): Promise<number> {
    return this.members.get(roomId)?.size ?? 0;
  }
  async setOwner(roomId: string, ownerId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) room.ownerId = ownerId;
  }
}

export class FakePresenceStore implements IPresenceStore {
  byRoom = new Map<string, Map<string, Participant>>();

  async set(roomId: string, participant: Participant): Promise<void> {
    if (!this.byRoom.has(roomId)) this.byRoom.set(roomId, new Map());
    this.byRoom.get(roomId)!.set(participant.userId, participant);
  }
  async update(
    roomId: string,
    userId: string,
    patch: Partial<Participant>,
  ): Promise<Participant | null> {
    const p = this.byRoom.get(roomId)?.get(userId);
    if (!p) return null;
    const next = { ...p, ...patch };
    this.byRoom.get(roomId)!.set(userId, next);
    return next;
  }
  async get(roomId: string, userId: string): Promise<Participant | null> {
    return this.byRoom.get(roomId)?.get(userId) ?? null;
  }
  async list(roomId: string): Promise<Participant[]> {
    return [...(this.byRoom.get(roomId)?.values() ?? [])];
  }
  async remove(roomId: string, userId: string): Promise<void> {
    this.byRoom.get(roomId)?.delete(userId);
  }
}

export class FakeConnectionRegistry implements IConnectionRegistry {
  byUser = new Map<string, Set<string>>();
  async add(userId: string, socketId: string): Promise<number> {
    if (!this.byUser.has(userId)) this.byUser.set(userId, new Set());
    this.byUser.get(userId)!.add(socketId);
    return this.byUser.get(userId)!.size;
  }
  async remove(userId: string, socketId: string): Promise<number> {
    this.byUser.get(userId)?.delete(socketId);
    return this.byUser.get(userId)?.size ?? 0;
  }
  async count(userId: string): Promise<number> {
    return this.byUser.get(userId)?.size ?? 0;
  }
}
