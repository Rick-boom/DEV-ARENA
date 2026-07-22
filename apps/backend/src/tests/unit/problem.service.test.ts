import { describe, expect, it, beforeEach } from 'vitest';
import { ProblemVisibility, Role } from '@prisma/client';
import { ProblemService } from '../../modules/problems/services/problem.service.js';
import { ForbiddenError, ProblemNotFoundError } from '../../errors/app-error.js';
import { PROBLEM_CONSTANTS } from '../../modules/problems/constants/problem.constants.js';
import {
  FakeBookmarkRepository,
  FakeCache,
  FakeProblemRepository,
  makeProblem,
} from '../fakes/fakes.js';

describe('ProblemService', () => {
  let problems: FakeProblemRepository;
  let bookmarks: FakeBookmarkRepository;
  let cache: FakeCache;
  let service: ProblemService;

  beforeEach(() => {
    problems = new FakeProblemRepository();
    bookmarks = new FakeBookmarkRepository();
    cache = new FakeCache();
    service = new ProblemService(problems, bookmarks, cache);
  });

  describe('getByIdOrSlug — visibility gating', () => {
    it('returns a public problem to a guest', async () => {
      problems.problems.push(makeProblem());
      const dto = await service.getByIdOrSlug('two-sum');
      expect(dto.slug).toBe('two-sum');
    });

    it('throws 404 for unknown problems', async () => {
      await expect(service.getByIdOrSlug('nope')).rejects.toBeInstanceOf(ProblemNotFoundError);
    });

    it('hides DRAFT problems from regular users as 404 (not 403)', async () => {
      problems.problems.push(makeProblem({ visibility: ProblemVisibility.DRAFT }));
      await expect(
        service.getByIdOrSlug('two-sum', { id: 'u1', role: Role.USER }),
      ).rejects.toBeInstanceOf(ProblemNotFoundError);
    });

    it('shows DRAFT problems to moderators', async () => {
      problems.problems.push(makeProblem({ visibility: ProblemVisibility.DRAFT }));
      const dto = await service.getByIdOrSlug('two-sum', { id: 'm1', role: Role.MODERATOR });
      expect(dto.id).toBeDefined();
    });

    it('rejects PREMIUM problems for free users with Forbidden', async () => {
      problems.problems.push(makeProblem({ visibility: ProblemVisibility.PREMIUM }));
      await expect(
        service.getByIdOrSlug('two-sum', { id: 'u1', role: Role.USER }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('allows PREMIUM problems for premium users', async () => {
      problems.problems.push(makeProblem({ visibility: ProblemVisibility.PREMIUM }));
      const dto = await service.getByIdOrSlug('two-sum', { id: 'p1', role: Role.PREMIUM });
      expect(dto.slug).toBe('two-sum');
    });
  });

  describe('security — hidden test cases', () => {
    it('never includes hidden test cases in the public detail DTO', async () => {
      problems.problems.push(makeProblem());
      const dto = await service.getByIdOrSlug('two-sum');
      expect(dto.sampleTestCases).toHaveLength(1);
      expect(JSON.stringify(dto)).not.toContain('SECRET');
    });
  });

  describe('viewer flags', () => {
    it('marks solved and bookmarked problems for the viewer', async () => {
      const p = makeProblem();
      problems.problems.push(p);
      problems.solvedByUser.set('u1', [p.id]);
      await bookmarks.add('u1', p.id);
      const dto = await service.getByIdOrSlug(p.id, { id: 'u1', role: Role.USER });
      expect(dto.isSolved).toBe(true);
      expect(dto.isBookmarked).toBe(true);
    });
  });

  describe('trending', () => {
    it('computes trending once and serves the second call from cache', async () => {
      problems.problems.push(makeProblem());
      const first = await service.trending();
      expect(first).toHaveLength(1);
      expect(cache.store.has(PROBLEM_CONSTANTS.CACHE.KEYS.trending)).toBe(true);

      // Wipe the repository — cached response must still serve.
      problems.problems.length = 0;
      const second = await service.trending();
      expect(second).toHaveLength(1);
    });

    it('personalizes cached trending rows per viewer', async () => {
      const p = makeProblem();
      problems.problems.push(p);
      await service.trending(); // warm cache (guest view)
      problems.solvedByUser.set('u1', [p.id]);
      const rows = await service.trending({ id: 'u1', role: Role.USER });
      expect(rows[0]?.isSolved).toBe(true);
    });
  });

  describe('acceptance rate', () => {
    it('computes acceptance with one decimal and guards divide-by-zero', async () => {
      problems.problems.push(makeProblem({ solvedCount: 1, submissionCount: 3 }));
      const dto = await service.getByIdOrSlug('two-sum');
      expect(dto.acceptanceRate).toBe(33.3);

      problems.problems.length = 0;
      problems.problems.push(makeProblem({ slug: 'fresh', solvedCount: 0, submissionCount: 0 }));
      const fresh = await service.getByIdOrSlug('fresh');
      expect(fresh.acceptanceRate).toBe(0);
    });
  });
});
