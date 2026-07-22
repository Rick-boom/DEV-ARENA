import http from 'node:http';
import { Redis } from 'ioredis';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';
import { buildIoServer } from './gateway/io-server.js';
import { SocketGateway } from './gateway/socket.gateway.js';
import { RoomManager } from './managers/room.manager.js';
import { PresenceManager } from './managers/presence.manager.js';
import { RedisRoomStore } from './managers/redis-room.store.js';
import { RedisPresenceStore } from './managers/redis-presence.store.js';
import { RedisConnectionRegistry } from './managers/redis-connection.registry.js';

/**
 * Composition root. Builds the concrete Redis-backed stores, wires
 * them into the managers, builds the Socket.IO server (with its own
 * pub/sub Redis pair for the adapter), and starts the gateway. Every
 * dependency is constructed here and injected downward — nothing below
 * news-up its own collaborators, so the whole graph is swappable and
 * testable.
 *
 * Scaling: run N copies of this process behind a sticky-session load
 * balancer. The Redis adapter makes them one logical server; the
 * Redis stores make room/presence state shared. That is the entire
 * horizontal-scaling story to reach 50k concurrent sockets.
 */
async function main(): Promise<void> {
  // One shared HTTP server carries both the Express health app and the
  // Socket.IO upgrade traffic.
  const server = http.createServer();

  // The Redis adapter needs its own pub + sub connections, separate
  // from the data connection, per the adapter's requirements.
  const pubClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();
  const dataClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const roomStore = new RedisRoomStore(dataClient);
  const presenceStore = new RedisPresenceStore(dataClient);
  const connectionRegistry = new RedisConnectionRegistry(dataClient);

  const roomManager = new RoomManager(roomStore);
  const presenceManager = new PresenceManager(presenceStore);

  const { io } = buildIoServer(server, pubClient, subClient);

  const gateway = new SocketGateway(io, roomManager, presenceManager, connectionRegistry);
  gateway.register();

  server.on('request', createApp(io));

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'socket service listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    io.close();
    server.close();
    pubClient.disconnect();
    subClient.disconnect();
    dataClient.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'socket service failed to start');
  process.exit(1);
});
