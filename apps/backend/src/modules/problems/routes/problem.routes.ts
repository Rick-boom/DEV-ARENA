import { Router, type Router as RouterType } from 'express';
import { optionalAuth, requireAuth } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import type { ProblemController } from '../controllers/problem.controller.js';
import {
  listProblemsQuerySchema,
  problemIdParamSchema,
  searchProblemsQuerySchema,
} from '../validators/problem.schemas.js';

/**
 * Public/user routes. ORDER MATTERS: literal segments (search,
 * trending, bookmarks, recently-solved, tags, companies) are declared
 * BEFORE the /:id catch-all so "trending" is never treated as a slug.
 */
export function buildProblemRouter(controller: ProblemController): RouterType {
  const router = Router();

  router.get(
    '/problems',
    optionalAuth,
    validate('query', listProblemsQuerySchema),
    controller.list,
  );
  router.get(
    '/problems/search',
    optionalAuth,
    validate('query', searchProblemsQuerySchema),
    controller.search,
  );
  router.get('/problems/trending', optionalAuth, controller.trending);
  router.get('/problems/recently-solved', requireAuth, controller.recentlySolved);
  router.get(
    '/problems/bookmarks',
    requireAuth,
    validate('query', listProblemsQuerySchema),
    controller.listBookmarks,
  );
  router.get('/tags', controller.listTags);
  router.get('/companies', controller.listCompanies);

  router.get(
    '/problems/:id',
    optionalAuth,
    validate('params', problemIdParamSchema),
    controller.getOne,
  );
  router.post(
    '/problems/:id/bookmark',
    requireAuth,
    validate('params', problemIdParamSchema),
    controller.addBookmark,
  );
  router.delete(
    '/problems/:id/bookmark',
    requireAuth,
    validate('params', problemIdParamSchema),
    controller.removeBookmark,
  );

  return router;
}
