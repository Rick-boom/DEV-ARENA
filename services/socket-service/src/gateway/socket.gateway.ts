import type { Server, Socket } from 'socket.io';
import { env } from '../config/env.js';
import { DuplicateConnectionError } from '../errors/socket-error.js';
import { createModuleLogger } from '../utils/logger.js';
import { registerRateLimiter } from '../middlewares/rate-limit.middleware.js';
import { registerRoomHandlers, handleLeave } from '../handlers/room.handlers.js';
import { registerPresenceHandlers } from '../handlers/presence.handlers.js';
import type { RoomManager } from '../managers/room.manager.js';
import type { PresenceManager } from '../managers/presence.manager.js';
import type { IConnectionRegistry } from '../interfaces/store.interfaces.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/events.types.js';

const log = createModuleLogger('gateway');

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * The gateway is the connection lifecycle owner. For each accepted
 * (already-authenticated) socket it:
 *   1. enforces the per-user connection limit (cross-node via Redis),
 *   2. installs the rate limiter,
 *   3. registers room + presence handlers,
 *   4. wires heartbeat + disconnect cleanup.
 *
 * It holds NO business rules — those live in the managers. This keeps
 * the transport wiring in exactly one place and everything it depends
 * on injected (testable, swappable).
 */
export class SocketGateway {
  constructor(
    private readonly io: IO,
    private readonly rooms: RoomManager,
    private readonly presence: PresenceManager,
    private readonly connections: IConnectionRegistry,
  ) {}

  /** Rooms this socket has joined — used to clean up on disconnect. */
  private readonly joinedRooms = new WeakMap<TypedSocket, Set<string>>();

  register(): void {
    this.io.on('connection', (socket: TypedSocket) => void this.onConnection(socket));
  }

  private async onConnection(socket: TypedSocket): Promise<void> {
    const user = socket.data.user;

    // ── connection limit (security) ────────────────────────────────
    const liveCount = await this.connections.add(user.id, socket.id);
    if (liveCount > env.MAX_CONNECTIONS_PER_USER) {
      await this.connections.remove(user.id, socket.id);
      const err = new DuplicateConnectionError(env.MAX_CONNECTIONS_PER_USER);
      socket.emit('error', { code: err.code, message: err.message });
      socket.disconnect(true);
      log.warn({ userId: user.id, liveCount }, 'connection limit exceeded');
      return;
    }

    this.joinedRooms.set(socket, new Set());
    log.info(
      { socketId: socket.id, userId: user.id, recovered: socket.recovered },
      'socket connected',
    );

    registerRateLimiter(socket);
    this.trackRoomMembership(socket);
    registerRoomHandlers(this.io, socket, this.rooms, this.presence);
    registerPresenceHandlers(this.io, socket, this.presence);
    this.registerHeartbeat(socket);
    this.registerDisconnect(socket);
  }

  /** Mirror join/leave into a local set so disconnect can clean up. */
  private trackRoomMembership(socket: TypedSocket): void {
    const rooms = this.joinedRooms.get(socket)!;
    socket.on('room:join', (payload) => {
      if (payload?.roomId) rooms.add(payload.roomId);
    });
    socket.on('room:leave', (payload) => {
      if (payload?.roomId) rooms.delete(payload.roomId);
    });
  }

  /**
   * Application-level heartbeat on TOP of Socket.IO's transport ping.
   * The transport ping proves the socket is alive; this heartbeat lets
   * the client measure round-trip latency and lets us refresh presence
   * liveness. Socket.IO already handles pingInterval/pingTimeout for
   * dead-connection detection; we don't reinvent that.
   */
  private registerHeartbeat(socket: TypedSocket): void {
    socket.on('heartbeat', (ack) => {
      if (typeof ack === 'function') ack({ ts: Date.now() });
    });
  }

  private registerDisconnect(socket: TypedSocket): void {
    socket.on('disconnect', (reason) => {
      void (async () => {
        const user = socket.data.user;
        const remaining = await this.connections.remove(user.id, socket.id);

        // Only tear down room presence when the user's LAST socket goes.
        // Otherwise a second tab / brief reconnect would evict them.
        if (remaining === 0) {
          const rooms = this.joinedRooms.get(socket) ?? new Set<string>();
          for (const roomId of rooms) {
            await handleLeave(this.io, socket, this.rooms, this.presence, roomId).catch((err) =>
              log.error({ err, roomId }, 'disconnect cleanup failed'),
            );
          }
        }
        log.info(
          { socketId: socket.id, userId: user.id, reason, remaining },
          'socket disconnected',
        );
      })();
    });
  }
}
