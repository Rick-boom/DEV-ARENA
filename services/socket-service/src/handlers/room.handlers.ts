import type { Server, Socket } from 'socket.io';
import { ioRoomName } from '../constants/rooms.js';
import { SocketError } from '../errors/socket-error.js';
import { createModuleLogger } from '../utils/logger.js';
import {
  createRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
  deleteRoomSchema,
  transferOwnershipSchema,
} from '../utils/validation.js';
import type { RoomManager } from '../managers/room.manager.js';
import type { PresenceManager } from '../managers/presence.manager.js';
import type {
  Ack,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/events.types.js';
import type { Participant, Room } from '../types/domain.types.js';

const log = createModuleLogger('room-handlers');

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/** Wraps a handler so any SocketError becomes a clean ack; bugs → generic. */
function guard<T>(
  fn: () => Promise<T>,
  ack: ((res: Ack<T>) => void) | undefined,
  socket: TypedSocket,
): void {
  fn()
    .then((data) => ack?.({ ok: true, data }))
    .catch((err: unknown) => {
      if (err instanceof SocketError) {
        ack?.({ ok: false, error: { code: err.code, message: err.message } });
        socket.emit('error', { code: err.code, message: err.message });
      } else {
        log.error({ err }, 'unhandled handler error');
        ack?.({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
      }
    });
}

/**
 * Room event handlers. Each is a thin adapter: validate payload →
 * call the manager → mutate Socket.IO room membership → broadcast to
 * the room. Broadcasts use io.to(room), so with the Redis adapter they
 * reach members connected to ANY node — cross-instance events for free.
 */
export function registerRoomHandlers(
  io: IO,
  socket: TypedSocket,
  rooms: RoomManager,
  presence: PresenceManager,
): void {
  const user = socket.data.user;

  socket.on('room:create', (payload, ack) => {
    guard<{ room: Room }>(
      async () => {
        const { type, roomId } = createRoomSchema.parse(payload);
        const room = await rooms.create(user.id, type, roomId);
        return { room };
      },
      ack,
      socket,
    );
  });

  socket.on('room:join', (payload, ack) => {
    guard<{ room: Room; participants: Participant[] }>(
      async () => {
        const { roomId } = joinRoomSchema.parse(payload);
        const room = await rooms.join(roomId, user.id);
        const participant = await presence.join(roomId, user);

        await socket.join(ioRoomName(roomId));
        // Tell everyone already here that a new participant arrived.
        socket.to(ioRoomName(roomId)).emit('room:user-joined', { roomId, participant });

        const participants = await presence.list(roomId);
        log.info({ roomId, userId: user.id }, 'user joined room');
        return { room, participants };
      },
      ack,
      socket,
    );
  });

  socket.on('room:leave', (payload, ack) => {
    guard<{ left: true }>(
      async () => {
        const { roomId } = leaveRoomSchema.parse(payload);
        await handleLeave(io, socket, rooms, presence, roomId);
        return { left: true };
      },
      ack,
      socket,
    );
  });

  socket.on('room:delete', (payload, ack) => {
    guard<{ deleted: true }>(
      async () => {
        const { roomId } = deleteRoomSchema.parse(payload);
        await rooms.delete(roomId, user.id);
        io.to(ioRoomName(roomId)).emit('room:closed', { roomId, reason: 'deleted by owner' });
        // Evict all sockets from the Socket.IO room across all nodes.
        io.in(ioRoomName(roomId)).socketsLeave(ioRoomName(roomId));
        return { deleted: true };
      },
      ack,
      socket,
    );
  });

  socket.on('room:transfer-ownership', (payload, ack) => {
    guard<{ room: Room }>(
      async () => {
        const { roomId, toUserId } = transferOwnershipSchema.parse(payload);
        const room = await rooms.transferOwnership(roomId, user.id, toUserId);
        io.to(ioRoomName(roomId)).emit('room:ownership-changed', { roomId, ownerId: toUserId });
        return { room };
      },
      ack,
      socket,
    );
  });
}

/**
 * Shared leave logic (used by explicit leave AND disconnect). Removes
 * membership + presence, notifies the room, and auto-promotes a new
 * owner if the owner was the one who left and others remain.
 */
export async function handleLeave(
  io: IO,
  socket: TypedSocket,
  rooms: RoomManager,
  presence: PresenceManager,
  roomId: string,
): Promise<void> {
  const user = socket.data.user;
  await presence.leave(roomId, user.id);
  const { room } = await rooms.leave(roomId, user.id);
  await socket.leave(ioRoomName(roomId));
  socket.to(ioRoomName(roomId)).emit('room:user-left', { roomId, userId: user.id });

  if (room) {
    const remaining = (await presence.list(roomId)).map((p) => p.userId);
    const newOwner = await rooms.handleOwnerDisconnect(roomId, remaining);
    if (newOwner) {
      io.to(ioRoomName(roomId)).emit('room:ownership-changed', { roomId, ownerId: newOwner });
    }
  }
}
