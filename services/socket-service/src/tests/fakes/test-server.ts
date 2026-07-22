import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { createAuthMiddleware } from '../../middlewares/auth.middleware.js';
import { SocketGateway } from '../../gateway/socket.gateway.js';
import { RoomManager } from '../../managers/room.manager.js';
import { PresenceManager } from '../../managers/presence.manager.js';
import { FakeConnectionRegistry, FakePresenceStore, FakeRoomStore } from './fake-stores.js';
import type { DevArenaIO } from '../../gateway/io-server.js';

/**
 * Spins up a real Socket.IO server on an ephemeral port using the
 * DEFAULT in-memory adapter and the in-memory fake stores. This tests
 * the true gateway → handler → manager path end-to-end over real
 * websockets, without Redis. (The Redis adapter is a drop-in transport
 * swap; the handler logic under test is identical.)
 */
export interface TestServer {
  url: string;
  registry: FakeConnectionRegistry;
  rooms: FakeRoomStore;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const httpServer = http.createServer();
  const rawIo = new Server(httpServer, {
    connectionStateRecovery: { maxDisconnectionDuration: env.RECOVERY_WINDOW_MS },
  });
  const namespace = rawIo.of('/rt');
  namespace.use(createAuthMiddleware());

  const roomStore = new FakeRoomStore();
  const presenceStore = new FakePresenceStore();
  const registry = new FakeConnectionRegistry();

  const gateway = new SocketGateway(
    namespace as unknown as DevArenaIO,
    new RoomManager(roomStore),
    new PresenceManager(presenceStore),
    registry,
  );
  gateway.register();

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    url: `http://localhost:${port}/rt`,
    registry,
    rooms: roomStore,
    close: () =>
      new Promise<void>((resolve) => {
        rawIo.close();
        httpServer.close(() => resolve());
      }),
  };
}

/** Mint a valid access token the auth middleware will accept. */
export function tokenFor(userId: string, username = userId, role = 'USER'): string {
  return jwt.sign({ sub: userId, username, role }, env.JWT_ACCESS_SECRET);
}
