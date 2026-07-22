import { describe, expect, it, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { buildProblemRouter } from '../../modules/problems/routes/problem.routes.js';
import { buildProblemAdminRouter } from '../../modules/problems/routes/problem-admin.routes.js';
import { ProblemController } from '../../modules/problems/controllers/problem.controller.js';
import { ProblemAdminController } from '../../modules/problems/controllers/problem-admin.controller.js';
import { ProblemService } from '../../modules/problems/services/problem.service.js';
import { ProblemAdminService } from '../../modules/problems/services/problem-admin.service.js';
import { BookmarkService } from '../../modules/problems/services/bookmark.service.js';
import { TaxonomyService } from '../../modules/problems/services/taxonomy.service.js';
import { errorMiddleware } from '../../middlewares/error.middleware.js';
import {
  FakeAuditLog,
  FakeBookmarkRepository,
  FakeCache,
  FakeProblemRepository,
  FakeTaxonomyRepository,
  makeProblem,
} from '../fakes/fakes.js';

/**
 * Integration tests: real Express app, real routers, real middleware
 * chain (auth → validation → controller → error handler), fake
 * persistence. Verifies HTTP wiring end-to-end without a database.
 */
function token(role: Role, sub = 'user-1'): string {
  return jwt.sign({ sub, role }, process.env.JWT_ACCESS_SECRET as string);
}

function buildApp(problems: FakeProblemRepository) {
  const bookmarks = new FakeBookmarkRepository();
  const taxonomy = new FakeTaxonomyRepository();
  const audit = new FakeAuditLog();
  const cache = new FakeCache();

  const problemService = new ProblemService(problems, bookmarks, cache);
  const bookmarkService = new BookmarkService(bookmarks, problems);
  const taxonomyService = new TaxonomyService(taxonomy, audit, cache);
  const adminService = new ProblemAdminService(problems, taxonomy, audit, cache);

  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1',
    buildProblemRouter(new ProblemController(problemService, bookmarkService, taxonomyService)),
  );
  app.use(
    '/api/v1/admin',
    buildProblemAdminRouter(new ProblemAdminController(adminService, taxonomyService)),
  );
  app.use(errorMiddleware);
  return { app, audit };
}

describe('Problem routes (integration)', () => {
  let problems: FakeProblemRepository;
  let app: express.Express;
  let audit: FakeAuditLog;

  beforeEach(() => {
    problems = new FakeProblemRepository();
    problems.problems.push(makeProblem());
    ({ app, audit } = buildApp(problems));
  });

  describe('GET /api/v1/problems', () => {
    it('200s with the paginated envelope for guests', async () => {
      const res = await request(app).get('/api/v1/problems');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
    });

    it('422s on invalid query values', async () => {
      const res = await request(app).get('/api/v1/problems?pageSize=5000');
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/problems/search', () => {
    it('422s when the keyword is missing', async () => {
      const res = await request(app).get('/api/v1/problems/search');
      expect(res.status).toBe(422);
    });

    it('200s with a keyword', async () => {
      const res = await request(app).get('/api/v1/problems/search?q=sum');
      expect(res.status).toBe(200);
    });
  });

  describe('route ordering', () => {
    it('/problems/trending is NOT swallowed by /problems/:id', async () => {
      const res = await request(app).get('/api/v1/problems/trending');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/problems/:id', () => {
    it('resolves by slug and hides hidden test cases', async () => {
      const res = await request(app).get('/api/v1/problems/two-sum');
      expect(res.status).toBe(200);
      expect(res.body.data.sampleTestCases).toHaveLength(1);
      expect(JSON.stringify(res.body)).not.toContain('SECRET');
    });

    it('404s with PROBLEM_NOT_FOUND for unknown slugs', async () => {
      const res = await request(app).get('/api/v1/problems/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROBLEM_NOT_FOUND');
    });
  });

  describe('bookmarks', () => {
    it('401s without a token', async () => {
      const res = await request(app).post('/api/v1/problems/two-sum/bookmark');
      expect(res.status).toBe(401);
    });

    it('bookmarks and unbookmarks with a valid token', async () => {
      const auth = { Authorization: `Bearer ${token(Role.USER)}` };
      const add = await request(app).post('/api/v1/problems/two-sum/bookmark').set(auth);
      expect(add.status).toBe(201);

      const list = await request(app).get('/api/v1/problems/bookmarks').set(auth);
      expect(list.body.data.total).toBe(1);

      const del = await request(app).delete('/api/v1/problems/two-sum/bookmark').set(auth);
      expect(del.status).toBe(200);
    });
  });

  describe('admin surface', () => {
    const validBody = {
      title: 'Merge Intervals',
      statement: 'Merge all overlapping intervals and return the result sorted.',
      difficulty: 'MEDIUM',
      examples: [{ input: '[[1,3],[2,6]]', output: '[[1,6]]' }],
    };

    it('401s without a token, 403s for regular users', async () => {
      expect((await request(app).post('/api/v1/admin/problems').send(validBody)).status).toBe(401);
      expect(
        (
          await request(app)
            .post('/api/v1/admin/problems')
            .set({ Authorization: `Bearer ${token(Role.USER)}` })
            .send(validBody)
        ).status,
      ).toBe(403);
    });

    it('creates a problem as ADMIN and records an audit entry', async () => {
      const res = await request(app)
        .post('/api/v1/admin/problems')
        .set({ Authorization: `Bearer ${token(Role.ADMIN, 'admin-1')}` })
        .send(validBody);
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Merge Intervals');
      expect(audit.entries.map((e) => e.action)).toContain('problem.create');
    });

    it('422s on invalid difficulty (InvalidDifficulty as a validation error)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/problems')
        .set({ Authorization: `Bearer ${token(Role.ADMIN)}` })
        .send({ ...validBody, difficulty: 'IMPOSSIBLE' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body.error.details)).toContain('difficulty');
    });

    it('409s with VERSION_CONFLICT on a stale PATCH', async () => {
      const existing = problems.problems[0]!;
      existing.version = 3;
      const res = await request(app)
        .patch(`/api/v1/admin/problems/${existing.id}`)
        .set({ Authorization: `Bearer ${token(Role.ADMIN)}` })
        .send({ expectedVersion: 2, title: 'Stale write attempt' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VERSION_CONFLICT');
    });

    it('soft-deletes with 204 and the problem disappears from public reads', async () => {
      const existing = problems.problems[0]!;
      const del = await request(app)
        .delete(`/api/v1/admin/problems/${existing.id}`)
        .set({ Authorization: `Bearer ${token(Role.ADMIN)}` });
      expect(del.status).toBe(204);

      const pub = await request(app).get(`/api/v1/problems/${existing.slug}`);
      expect(pub.status).toBe(404);
    });

    it('replaces test cases via PUT with count in response', async () => {
      const existing = problems.problems[0]!;
      const res = await request(app)
        .put(`/api/v1/admin/problems/${existing.id}/test-cases`)
        .set({ Authorization: `Bearer ${token(Role.ADMIN)}` })
        .send({
          testCases: [
            { input: 'a', expectedOutput: 'b' },
            { input: 'c', expectedOutput: 'd', isHidden: false },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(2);
    });
  });
});
