import type http from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { createModuleLogger } from '../utils/logger.js';
import { createAuthMiddleware } from '../middlewares/auth.middleware.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/events.types.js';

const log = createModuleLogger('io-server');

export type DevArenaIO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Builds the Socket.IO server with production settings:
 *
 * • Redis adapter (pub + sub duplicated connections) — this is what
 *   makes 50k connections across many nodes behave as one logical
 *   server: a broadcast on any node fans out to members on every node.
 * • connectionStateRecovery — on a brief drop the client transparently
 *   resumes its session and MISSED EVENTS ARE REPLAYED, so a flaky
 *   network doesn't lose room messages (the "connection recovery" and
 *   "reconnect sync" the spec asks for, at the transport layer).
 * • the auth middleware is installed on the namespace so every socket
 *   is authenticated before `connection` fires.
 *
 * The '/rt' namespace isolates this real-time traffic from any other
 * Socket.IO usage and gives us a clean place to scope middleware.
 */
export function buildIoServer(
  httpServer: http.Server,
  pubClient: Redis,
  subClient: Redis,
): { io: DevArenaIO } {
  const io: DevArenaIO = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true },
    adapter: createAdapter(pubClient, subClient),
    connectionStateRecovery: {
      maxDisconnectionDuration: env.RECOVERY_WINDOW_MS,
      skipMiddlewares: false, // re-auth on recovery — a token may have expired
    },
    pingInterval: env.HEARTBEAT_INTERVAL_MS,
    pingTimeout: env.HEARTBEAT_TIMEOUT_MS,
    // Bound payloads so a giant frame can't exhaust a node.
    maxHttpBufferSize: 1_000_000,
  });

  const namespace = io.of('/rt');
  namespace.use(createAuthMiddleware());
  log.info({ recoveryMs: env.RECOVERY_WINDOW_MS }, 'io server built with redis adapter');

  return { io: namespace as unknown as DevArenaIO };
}
