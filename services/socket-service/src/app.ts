import express, { type Express } from 'express';
import helmet from 'helmet';
import { createHealthHandler } from './controllers/health.controller.js';
import { asyncApiSpec } from './docs/asyncapi.js';
import { openApiSpec } from './docs/openapi.js';
import type { DevArenaIO } from './gateway/io-server.js';

/**
 * The thin Express app that rides alongside Socket.IO on the same HTTP
 * server. It exists only for health/readiness + serving the API
 * contract — all real traffic is WebSocket. Keeping a tiny HTTP surface
 * means standard LB health checks and platform probes work unchanged.
 */
export function createApp(io: DevArenaIO): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.get('/health', createHealthHandler(io));
  app.get('/docs.json', (_req, res) => res.json(asyncApiSpec));
  app.get('/openapi.json', (_req, res) => res.json(openApiSpec));
  app.get('/', (_req, res) => res.json({ service: 'devarena-socket', status: 'ok' }));
  return app;
}
