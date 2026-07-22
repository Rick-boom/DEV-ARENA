import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middlewares/request-logger.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { buildRouter } from './routes/execution.routes.js';
import { ExecutionController, HealthController } from './controllers/execution.controller.js';
import { openApiSpec } from './docs/openapi.js';
import type { ExecutionQueue } from './queue/execution.queue.js';

/**
 * API app factory. The queue is INJECTED so tests can pass a fake and
 * never touch Redis. This process only enqueues + awaits results; the
 * heavy lifting happens in the worker process.
 */
export function createApp(queue: ExecutionQueue): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' })); // headroom for 64KB code + 1MB input
  app.use(requestLogger);

  const router = buildRouter(new ExecutionController(queue), new HealthController(queue));
  app.use('/', router);

  app.get('/docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec as never));

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  app.use(errorMiddleware);
  return app;
}
