import type { PrismaClient } from '@prisma/client';
import type { Router } from 'express';
import type { ICacheService } from '../../lib/cache.js';
import { ProblemController } from './controllers/problem.controller.js';
import { ProblemAdminController } from './controllers/problem-admin.controller.js';
import { AuditLogRepository } from './repositories/audit-log.repository.js';
import { BookmarkRepository } from './repositories/bookmark.repository.js';
import { ProblemRepository } from './repositories/problem.repository.js';
import { TaxonomyRepository } from './repositories/taxonomy.repository.js';
import { buildProblemAdminRouter } from './routes/problem-admin.routes.js';
import { buildProblemRouter } from './routes/problem.routes.js';
import { BookmarkService } from './services/bookmark.service.js';
import { ProblemAdminService } from './services/problem-admin.service.js';
import { ProblemService } from './services/problem.service.js';
import { TaxonomyService } from './services/taxonomy.service.js';

/**
 * Composition root — the ONLY place where concrete classes meet.
 * Plain constructor injection, no DI framework: at this scale a
 * container library adds reflection magic without adding value, and
 * tests build the same graph with fakes in three lines.
 */
export interface ProblemModule {
  publicRouter: Router;
  adminRouter: Router;
}

export function createProblemModule(prisma: PrismaClient, cache: ICacheService): ProblemModule {
  // Repositories (data access)
  const problemRepo = new ProblemRepository(prisma);
  const bookmarkRepo = new BookmarkRepository(prisma);
  const taxonomyRepo = new TaxonomyRepository(prisma);
  const auditRepo = new AuditLogRepository(prisma);

  // Services (business rules)
  const problemService = new ProblemService(problemRepo, bookmarkRepo, cache);
  const bookmarkService = new BookmarkService(bookmarkRepo, problemRepo);
  const taxonomyService = new TaxonomyService(taxonomyRepo, auditRepo, cache);
  const adminService = new ProblemAdminService(problemRepo, taxonomyRepo, auditRepo, cache);

  // Controllers (HTTP adapters)
  const problemController = new ProblemController(problemService, bookmarkService, taxonomyService);
  const adminController = new ProblemAdminController(adminService, taxonomyService);

  return {
    publicRouter: buildProblemRouter(problemController),
    adminRouter: buildProblemAdminRouter(adminController),
  };
}
