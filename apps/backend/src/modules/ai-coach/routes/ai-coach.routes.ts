import { Router, type Router as RouterType } from 'express';
import { requireAuth } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import type { AiCoachController } from '../controllers/ai-coach.controller.js';
import {
  complexitySchema,
  hintSchema,
  historyQuerySchema,
  interviewSchema,
  learningSchema,
  recommendSchema,
  reviewSchema,
} from '../validators/ai.schemas.js';

/** All AI routes require auth. */
export function buildAiCoachRouter(c: AiCoachController): RouterType {
  const router = Router();
  router.use(requireAuth);

  router.post('/ai/hint', validate('body', hintSchema), c.hint);
  router.post('/ai/review', validate('body', reviewSchema), c.review);
  router.post('/ai/complexity', validate('body', complexitySchema), c.complexity);
  router.post('/ai/interview', validate('body', interviewSchema), c.interview);
  router.post('/ai/learning', validate('body', learningSchema), c.learning);
  router.post('/ai/recommend', validate('body', recommendSchema), c.recommend);
  router.get('/ai/history', validate('query', historyQuerySchema), c.history);

  return router;
}
