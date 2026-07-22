import { describe, expect, it, beforeEach } from 'vitest';
import { RoomManager } from '../../managers/room.manager.js';
import { RoomType } from '../../types/domain.types.js';
import { RoomFullError, RoomNotFoundError, UnauthorizedError } from '../../errors/socket-error.js';
import { FakeRoomStore } from '../fakes/fake-stores.js';

describe('RoomManager', () => {
  let store: FakeRoomStore;
  let manager: RoomManager;

  beforeEach(() => {
    store = new FakeRoomStore();
    manager = new RoomManager(store);
  });

  describe('create', () => {
    it('creates a room with the capacity for its type', async () => {
      const room = await manager.create('owner-1', RoomType.BATTLE);
      expect(room.ownerId).toBe('owner-1');
      expect(room.type).toBe(RoomType.BATTLE);
      expect(room.capacity).toBe(2); // BATTLE_ROOM_CAPACITY from test env
    });

    it('is idempotent for a given roomId (safe on reconnect)', async () => {
      const a = await manager.create('owner-1', RoomType.COLLABORATION, 'fixed-id');
      const b = await manager.create('owner-2', RoomType.COLLABORATION, 'fixed-id');
      expect(b.id).toBe(a.id);
      expect(b.ownerId).toBe('owner-1'); // original owner preserved
    });
  });

  describe('join', () => {
    it('adds a member and returns the updated room', async () => {
      const room = await manager.create('owner-1', RoomType.COLLABORATION);
      await manager.join(room.id, 'user-2');
      const updated = await manager.get(room.id);
      expect(updated?.memberIds).toContain('user-2');
    });

    it('rejects a new member when the room is at capacity', async () => {
      const room = await manager.create('owner-1', RoomType.BATTLE); // capacity 2
      await manager.join(room.id, 'a');
      await manager.join(room.id, 'b');
      await expect(manager.join(room.id, 'c')).rejects.toBeInstanceOf(RoomFullError);
    });

    it('lets an existing member re-join even at capacity (reconnect)', async () => {
      const room = await manager.create('owner-1', RoomType.BATTLE);
      await manager.join(room.id, 'a');
      await manager.join(room.id, 'b');
      await expect(manager.join(room.id, 'a')).resolves.toBeDefined();
    });

    it('404s on an unknown room', async () => {
      await expect(manager.join('ghost', 'u')).rejects.toBeInstanceOf(RoomNotFoundError);
    });
  });

  describe('leave', () => {
    it('closes the room when the last member leaves', async () => {
      const room = await manager.create('owner-1', RoomType.COLLABORATION);
      await manager.join(room.id, 'owner-1');
      await manager.leave(room.id, 'owner-1');
      expect(await manager.get(room.id)).toBeNull();
    });
  });

  describe('delete', () => {
    it('only the owner may delete', async () => {
      const room = await manager.create('owner-1', RoomType.INTERVIEW);
      await expect(manager.delete(room.id, 'intruder')).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(manager.delete(room.id, 'owner-1')).resolves.toBeDefined();
    });
  });

  describe('transferOwnership', () => {
    it('transfers to an existing member', async () => {
      const room = await manager.create('owner-1', RoomType.COLLABORATION);
      await manager.join(room.id, 'user-2');
      const updated = await manager.transferOwnership(room.id, 'owner-1', 'user-2');
      expect(updated.ownerId).toBe('user-2');
    });

    it('rejects transfer from a non-owner', async () => {
      const room = await manager.create('owner-1', RoomType.COLLABORATION);
      await manager.join(room.id, 'user-2');
      await expect(manager.transferOwnership(room.id, 'user-2', 'user-2')).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });

    it('rejects transfer to a non-member', async () => {
      const room = await manager.create('owner-1', RoomType.COLLABORATION);
      await expect(manager.transferOwnership(room.id, 'owner-1', 'stranger')).rejects.toBeDefined();
    });
  });

  describe('handleOwnerDisconnect', () => {
    it('auto-promotes the first remaining member when the owner vanishes', async () => {
      const room = await manager.create('owner-1', RoomType.COLLABORATION);
      await manager.join(room.id, 'user-2');
      const next = await manager.handleOwnerDisconnect(room.id, ['user-2']);
      expect(next).toBe('user-2');
    });

    it('does nothing if the owner is still present', async () => {
      const room = await manager.create('owner-1', RoomType.COLLABORATION);
      const next = await manager.handleOwnerDisconnect(room.id, ['owner-1', 'user-2']);
      expect(next).toBeNull();
    });
  });
});
