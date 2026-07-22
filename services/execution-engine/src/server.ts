import http from 'node:http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';
import { createRedisConnection } from './queue/connection.js';
import { ExecutionQueue } from './queue/execution.queue.js';

/**
 * API entry point. Composition root for the HTTP side: builds the
 * queue producer (two Redis connections — one for the queue, one for
 * QueueEvents result streaming), injects it into the app, and serves.
 * Runs as its own container so the stateless API scales independently
 * of the workers.
 */
async function main(): Promise<void> {
  const queueConn = createRedisConnection();
  const eventsConn = createRedisConnection();
  const queue = new ExecutionQueue(queueConn, eventsConn);
  await queue.waitUntilReady();

  const app = createApp(queue);
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'execution API listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'API shutting down');
    server.close();
    await queue.close();
    queueConn.disconnect();
    eventsConn.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'API failed to start');
  process.exit(1);
});
