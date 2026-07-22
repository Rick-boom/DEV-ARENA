import { createModuleLogger } from '../utils/logger.js';
import type { IPresenceStore } from '../interfaces/store.interfaces.js';
import { PresenceState, type CursorPosition, type Participant } from '../types/domain.types.js';
import type { AuthUser } from '../types/domain.types.js';

const log = createModuleLogger('presence-manager');

/**
 * Presence semantics: who is in a room and what they're doing
 * (online/idle, typing, focused, cursor). Store-backed so presence is
 * consistent across nodes. This manager holds NO transport concerns —
 * it returns the new state and lets the gateway decide how to
 * broadcast it.
 */
export class PresenceManager {
  constructor(private readonly presence: IPresenceStore) {}

  async join(roomId: string, user: AuthUser): Promise<Participant> {
    const participant: Participant = {
      userId: user.id,
      username: user.username,
      role: user.role,
      state: PresenceState.ONLINE,
      typing: false,
      focused: true,
      cursor: null,
      joinedAt: Date.now(),
    };
    await this.presence.set(roomId, participant);
    return participant;
  }

  list(roomId: string): Promise<Participant[]> {
    return this.presence.list(roomId);
  }

  async setState(
    roomId: string,
    userId: string,
    state: PresenceState,
  ): Promise<Participant | null> {
    return this.presence.update(roomId, userId, { state });
  }

  async setFocused(roomId: string, userId: string, focused: boolean): Promise<Participant | null> {
    // Losing window focus is a strong idle signal.
    return this.presence.update(roomId, userId, {
      focused,
      state: focused ? PresenceState.ONLINE : PresenceState.IDLE,
    });
  }

  async setTyping(roomId: string, userId: string, typing: boolean): Promise<Participant | null> {
    return this.presence.update(roomId, userId, { typing });
  }

  async setCursor(
    roomId: string,
    userId: string,
    cursor: CursorPosition,
  ): Promise<Participant | null> {
    return this.presence.update(roomId, userId, { cursor });
  }

  async leave(roomId: string, userId: string): Promise<void> {
    await this.presence.remove(roomId, userId);
    log.debug({ roomId, userId }, 'presence removed');
  }
}
