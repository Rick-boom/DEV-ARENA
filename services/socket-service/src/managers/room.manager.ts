import { randomUUID } from 'node:crypto';
import { ROOM_CAPACITY } from '../constants/rooms.js';
import {
  RoomFullError,
  RoomNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/socket-error.js';
import { createModuleLogger } from '../utils/logger.js';
import type { IRoomStore } from '../interfaces/store.interfaces.js';
import { RoomType, type Room } from '../types/domain.types.js';

const log = createModuleLogger('room-manager');

/**
 * Room lifecycle + authorization, independent of Socket.IO and Redis
 * (the store is injected). This is where every room RULE lives —
 * capacity, ownership, who may delete or transfer — so the socket
 * handlers stay thin and the rules are unit-testable without a server.
 */
export class RoomManager {
  constructor(private readonly rooms: IRoomStore) {}

  private capacityFor(type: RoomType): number {
    return ROOM_CAPACITY[type];
  }

  async create(ownerId: string, type: RoomType, roomId?: string): Promise<Room> {
    if (!Object.values(RoomType).includes(type)) {
      throw new ValidationError(`Unknown room type: ${type}`);
    }
    const id = roomId ?? randomUUID();
    const existing = await this.rooms.get(id);
    if (existing) return existing; // idempotent create (safe on reconnect)

    const room: Room = {
      id,
      type,
      ownerId,
      capacity: this.capacityFor(type),
      createdAt: Date.now(),
      memberIds: [],
    };
    await this.rooms.create(room);
    log.info({ roomId: id, type, ownerId }, 'room created');
    return room;
  }

  async join(roomId: string, userId: string): Promise<Room> {
    const room = await this.rooms.get(roomId);
    if (!room) throw new RoomNotFoundError(roomId);

    // Re-joining as an existing member (reconnect) never counts against
    // capacity; only a genuinely new member is capacity-checked.
    const alreadyMember = room.memberIds.includes(userId);
    if (!alreadyMember) {
      const count = await this.rooms.memberCount(roomId);
      if (count >= room.capacity) throw new RoomFullError(roomId, room.capacity);
    }
    await this.rooms.addMember(roomId, userId);
    return (await this.rooms.get(roomId))!;
  }

  async leave(roomId: string, userId: string): Promise<{ room: Room | null; ownerLeft: boolean }> {
    const room = await this.rooms.get(roomId);
    if (!room) return { room: null, ownerLeft: false };
    const remaining = await this.rooms.removeMember(roomId, userId);
    const ownerLeft = room.ownerId === userId;

    if (remaining === 0) {
      // Last one out closes the room — no empty rooms lingering.
      await this.rooms.delete(roomId);
      log.info({ roomId }, 'room emptied and closed');
      return { room: null, ownerLeft };
    }
    return { room: (await this.rooms.get(roomId))!, ownerLeft };
  }

  /** Only the owner may delete a room. */
  async delete(roomId: string, requesterId: string): Promise<Room> {
    const room = await this.rooms.get(roomId);
    if (!room) throw new RoomNotFoundError(roomId);
    if (room.ownerId !== requesterId) {
      throw new UnauthorizedError('Only the room owner can delete the room');
    }
    await this.rooms.delete(roomId);
    log.info({ roomId, requesterId }, 'room deleted by owner');
    return room;
  }

  /** Only the current owner may hand ownership to an existing member. */
  async transferOwnership(roomId: string, requesterId: string, toUserId: string): Promise<Room> {
    const room = await this.rooms.get(roomId);
    if (!room) throw new RoomNotFoundError(roomId);
    if (room.ownerId !== requesterId) {
      throw new UnauthorizedError('Only the room owner can transfer ownership');
    }
    if (!room.memberIds.includes(toUserId)) {
      throw new ValidationError('New owner must be a member of the room');
    }
    await this.rooms.setOwner(roomId, toUserId);
    log.info({ roomId, from: requesterId, to: toUserId }, 'ownership transferred');
    return { ...room, ownerId: toUserId };
  }

  /**
   * Called when a member disconnects entirely (all their sockets are
   * gone). If the owner vanished but the room still has members, we
   * auto-promote the earliest-joined remaining member so a room is
   * never left ownerless.
   */
  async handleOwnerDisconnect(
    roomId: string,
    remainingMemberIds: string[],
  ): Promise<string | null> {
    const room = await this.rooms.get(roomId);
    if (!room || remainingMemberIds.length === 0) return null;
    if (remainingMemberIds.includes(room.ownerId)) return null; // owner still present elsewhere
    const nextOwner = remainingMemberIds[0]!;
    await this.rooms.setOwner(roomId, nextOwner);
    log.info({ roomId, nextOwner }, 'owner auto-promoted after disconnect');
    return nextOwner;
  }

  get(roomId: string): Promise<Room | null> {
    return this.rooms.get(roomId);
  }
}
