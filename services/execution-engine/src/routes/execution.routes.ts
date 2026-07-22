import { Router, type Router as RouterType } from 'express';
import type { ExecutionController, HealthController } from '../controllers/execution.controller.js';

/** Wires controllers to paths. Kept declarative and dependency-free. */
export function buildRouter(execution: ExecutionController, health: HealthController): RouterType {
  const router = Router();
  router.get('/health', health.health);
  router.post('/execute', execution.execute);
  return router;
}
