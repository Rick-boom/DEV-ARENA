import { Router, type Router as RouterType } from 'express';
import { requireAuth } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import type { JudgeController } from '../controllers/judge.controller.js';
import {
  createSubmissionSchema,
  historyQuerySchema,
  resultQuerySchema,
  submissionIdSchema,
} from '../validators/judge.schemas.js';

/**
 * All judge routes require auth. Literal paths (/history, /result) are
 * registered BEFORE the /:id param route so "history" is never parsed
 * as a submission id.
 */
export function buildJudgeRouter(c: JudgeController): RouterType {
  const router = Router();
  router.use(requireAuth);

  router.post('/submission', validate('body', createSubmissionSchema), c.create);
  router.get('/submission/history', validate('query', historyQuerySchema), c.history);
  router.get('/submission/result', validate('query', resultQuerySchema), c.result);
  router.get('/submission/:id', validate('params', submissionIdSchema), c.getById);

  return router;
}
