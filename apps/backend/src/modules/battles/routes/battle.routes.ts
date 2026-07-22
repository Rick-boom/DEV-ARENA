import { Router, type Router as RouterType } from 'express';
import { requireAuth } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import type { BattleController } from '../controllers/battle.controller.js';
import {
  battleActionSchema,
  battleIdParamSchema,
  createBattleSchema,
  finishBattleSchema,
  historyQuerySchema,
  joinBattleSchema,
  rematchSchema,
} from '../validators/battle.schemas.js';

/**
 * All battle routes require auth. Literal paths (history) are declared
 * before the /:id catch-all so "history" is never treated as an id.
 */
export function buildBattleRouter(controller: BattleController): RouterType {
  const router = Router();
  router.use(requireAuth);

  router.post('/battle/create', validate('body', createBattleSchema), controller.create);
  router.post('/battle/join', validate('body', joinBattleSchema), controller.join);
  router.post('/battle/start', validate('body', battleActionSchema), controller.start);
  router.post('/battle/pause', validate('body', battleActionSchema), controller.pause);
  router.post('/battle/resume', validate('body', battleActionSchema), controller.resume);
  router.post('/battle/finish', validate('body', finishBattleSchema), controller.finish);
  router.post('/battle/rematch', validate('body', rematchSchema), controller.rematch);

  router.get('/battle/history', validate('query', historyQuerySchema), controller.history);
  router.get('/battle/:id/replay', validate('params', battleIdParamSchema), controller.replay);
  router.get('/battle/:id', validate('params', battleIdParamSchema), controller.getById);

  return router;
}
