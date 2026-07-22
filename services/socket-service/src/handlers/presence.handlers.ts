import type { Server, Socket } from 'socket.io';
import { ioRoomName } from '../constants/rooms.js';
import { createModuleLogger } from '../utils/logger.js';
import { acceptNonce } from '../middlewares/replay-guard.js';
import { cursorUpdateSchema, presenceUpdateSchema, typingSchema } from '../utils/validation.js';
import type { PresenceManager } from '../managers/presence.manager.js';
import type { PresenceState } from '../types/domain.types.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/events.types.js';

const log = createModuleLogger('presence-handlers');

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * High-frequency presence handlers (typing, cursor, focus). These are
 * fire-and-forget (no ack) for latency: a cursor move must not wait
 * for a round-trip. Broadcasts use socket.to(room) so the sender never
 * receives its own echo. Cursor updates are replay-guarded by nonce.
 */
export function registerPresenceHandlers(
  io: IO,
  socket: TypedSocket,
  presence: PresenceManager,
): void {
  const user = socket.data.user;

  socket.on('presence:update', (payload) => {
    void (async () => {
      const parsed = presenceUpdateSchema.safeParse(payload);
      if (!parsed.success) return;
      const { roomId, focused, state } = parsed.data;
      const updated =
        focused !== undefined
          ? await presence.setFocused(roomId, user.id, focused)
          : state !== undefined
            ? await presence.setState(roomId, user.id, state as PresenceState)
            : null;
      if (updated) {
        io.to(ioRoomName(roomId)).emit('presence:changed', {
          roomId,
          userId: user.id,
          state: updated.state,
          focused: updated.focused,
        });
      }
    })();
  });

  socket.on('typing:start', (payload) => void handleTyping(io, presence, user.id, payload, true));
  socket.on('typing:stop', (payload) => void handleTyping(io, presence, user.id, payload, false));

  socket.on('cursor:update', (payload) => {
    void (async () => {
      const parsed = cursorUpdateSchema.safeParse(payload);
      if (!parsed.success) return;
      // Replay protection: stale/duplicate cursor packets are dropped.
      if (!acceptNonce(socket.data, parsed.data.nonce)) {
        log.debug({ userId: user.id, nonce: parsed.data.nonce }, 'stale cursor nonce dropped');
        return;
      }
      const { roomId, cursor } = parsed.data;
      await presence.setCursor(roomId, user.id, cursor);
      socket.to(ioRoomName(roomId)).emit('cursor:changed', { roomId, userId: user.id, cursor });
    })();
  });
}

async function handleTyping(
  io: IO,
  presence: PresenceManager,
  userId: string,
  payload: { roomId: string },
  typing: boolean,
): Promise<void> {
  const parsed = typingSchema.safeParse(payload);
  if (!parsed.success) return;
  const updated = await presence.setTyping(parsed.data.roomId, userId, typing);
  if (updated) {
    io.to(ioRoomName(parsed.data.roomId)).emit('typing:changed', {
      roomId: parsed.data.roomId,
      userId,
      typing,
    });
  }
}
