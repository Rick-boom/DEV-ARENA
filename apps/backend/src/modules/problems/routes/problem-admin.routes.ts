import { Router, type Router as RouterType } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import type { ProblemAdminController } from '../controllers/problem-admin.controller.js';
import {
  createProblemBodySchema,
  problemIdParamSchema,
  updateProblemBodySchema,
  uploadTestCasesBodySchema,
  upsertCompanyBodySchema,
  upsertEditorialBodySchema,
  upsertHintsBodySchema,
  upsertTagBodySchema,
  versionParamSchema,
} from '../validators/problem.schemas.js';

/**
 * Admin surface, mounted under /admin. requireAuth + requireRole run
 * for the WHOLE router (router.use) so a forgotten guard on a new
 * route is impossible — secure by default.
 */
export function buildProblemAdminRouter(controller: ProblemAdminController): RouterType {
  const router = Router();

  router.use(requireAuth, requireRole(Role.ADMIN, Role.MODERATOR));

  router.post('/problems', validate('body', createProblemBodySchema), controller.create);
  router.get('/problems/:id', validate('params', problemIdParamSchema), controller.getOne);
  router.patch(
    '/problems/:id',
    validate('params', problemIdParamSchema),
    validate('body', updateProblemBodySchema),
    controller.update,
  );
  router.delete('/problems/:id', validate('params', problemIdParamSchema), controller.remove);

  router.post(
    '/problems/:id/publish',
    validate('params', problemIdParamSchema),
    controller.publish,
  );
  router.post(
    '/problems/:id/archive',
    validate('params', problemIdParamSchema),
    controller.archive,
  );

  router.put(
    '/problems/:id/test-cases',
    validate('params', problemIdParamSchema),
    validate('body', uploadTestCasesBodySchema),
    controller.uploadTestCases,
  );
  router.put(
    '/problems/:id/editorial',
    validate('params', problemIdParamSchema),
    validate('body', upsertEditorialBodySchema),
    controller.upsertEditorial,
  );
  router.put(
    '/problems/:id/hints',
    validate('params', problemIdParamSchema),
    validate('body', upsertHintsBodySchema),
    controller.upsertHints,
  );

  router.get(
    '/problems/:id/versions',
    validate('params', problemIdParamSchema),
    controller.listVersions,
  );
  router.get(
    '/problems/:id/versions/:version',
    validate('params', versionParamSchema),
    controller.getVersion,
  );

  router.post('/tags', validate('body', upsertTagBodySchema), controller.upsertTag);
  router.delete('/tags/:id', validate('params', problemIdParamSchema), controller.deleteTag);
  router.post('/companies', validate('body', upsertCompanyBodySchema), controller.upsertCompany);
  router.delete(
    '/companies/:id',
    validate('params', problemIdParamSchema),
    controller.deleteCompany,
  );

  return router;
}
