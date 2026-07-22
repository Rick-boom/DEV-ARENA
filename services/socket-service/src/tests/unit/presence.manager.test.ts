import { describe, expect, it, beforeEach } from 'vitest';
import { PresenceManager } from '../../managers/presence.manager.js';
import { PresenceState } from '../../types/domain.types.js';
import { FakePresenceStore } from '../fakes/fake-stores.js';

const user = { id: 'u1', role: 'USER', username: 'alice' };

describe('PresenceManager', () => {
  let store: FakePresenceStore;
  let manager: PresenceManager;

  beforeEach(() => {
    store = new FakePresenceStore();
    manager = new PresenceManager(store);
  });

  it('joins a user as online + focused', async () => {
    const p = await manager.join('room-1', user);
    expect(p.state).toBe(PresenceState.ONLINE);
    expect(p.focused).toBe(true);
    expect(p.typing).toBe(false);
  });

  it('marks a user idle when they lose window focus', async () => {
    await manager.join('room-1', user);
    const p = await manager.setFocused('room-1', 'u1', false);
    expect(p?.focused).toBe(false);
    expect(p?.state).toBe(PresenceState.IDLE);
  });

  it('toggles typing', async () => {
    await manager.join('room-1', user);
    expect((await manager.setTyping('room-1', 'u1', true))?.typing).toBe(true);
    expect((await manager.setTyping('room-1', 'u1', false))?.typing).toBe(false);
  });

  it('updates cursor position', async () => {
    await manager.join('room-1', user);
    const p = await manager.setCursor('room-1', 'u1', { line: 12, column: 4 });
    expect(p?.cursor).toEqual({ line: 12, column: 4 });
  });

  it('returns null when updating a user who never joined', async () => {
    expect(await manager.setTyping('room-1', 'ghost', true)).toBeNull();
  });

  it('lists and removes participants', async () => {
    await manager.join('room-1', user);
    await manager.join('room-1', { id: 'u2', role: 'USER', username: 'bob' });
    expect(await manager.list('room-1')).toHaveLength(2);
    await manager.leave('room-1', 'u1');
    expect(await manager.list('room-1')).toHaveLength(1);
  });
});
