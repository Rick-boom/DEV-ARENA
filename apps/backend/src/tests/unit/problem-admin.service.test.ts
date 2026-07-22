import { describe, expect, it, beforeEach } from 'vitest';
import { Difficulty, ProblemVisibility, Role } from '@prisma/client';
import {
  ProblemAdminService,
  slugify,
} from '../../modules/problems/services/problem-admin.service.js';
import {
  DuplicateProblemError,
  ProblemNotFoundError,
  VersionConflictError,
} from '../../errors/app-error.js';
import {
  FakeAuditLog,
  FakeCache,
  FakeProblemRepository,
  FakeTaxonomyRepository,
  makeProblem,
} from '../fakes/fakes.js';
import type { CreateProblemDto } from '../../modules/problems/dto/problem-request.dto.js';

const admin = { id: 'admin-1', role: Role.ADMIN };

function createDto(overrides: Partial<CreateProblemDto> = {}): CreateProblemDto {
  return {
    title: 'Reverse Linked List',
    statement: 'Reverse a singly linked list and return the new head node.',
    difficulty: Difficulty.EASY,
    visibility: ProblemVisibility.DRAFT,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    tags: ['linked-list'],
    companies: ['google'],
    examples: [{ input: '1->2->3', output: '3->2->1' }],
    constraints: ['1 <= n <= 5000'],
    hints: ['Walk the list once.'],
    ...overrides,
  };
}

describe('ProblemAdminService', () => {
  let problems: FakeProblemRepository;
  let taxonomy: FakeTaxonomyRepository;
  let audit: FakeAuditLog;
  let cache: FakeCache;
  let service: ProblemAdminService;

  beforeEach(() => {
    problems = new FakeProblemRepository();
    taxonomy = new FakeTaxonomyRepository();
    audit = new FakeAuditLog();
    cache = new FakeCache();
    service = new ProblemAdminService(problems, taxonomy, audit, cache);
  });

  describe('slugify', () => {
    it('produces url-safe kebab-case', () => {
      expect(slugify('Two Sum II — Input Array Is Sorted!')).toBe(
        'two-sum-ii-input-array-is-sorted',
      );
    });
  });

  describe('create', () => {
    it('creates a problem, auto-creates taxonomy, records audit', async () => {
      const dto = await service.create(createDto(), admin);
      expect(dto.title).toBe('Reverse Linked List');
      expect(taxonomy.tags.has('linked-list')).toBe(true);
      expect(taxonomy.companies.has('google')).toBe(true);
      expect(audit.entries.map((e) => e.action)).toContain('problem.create');
    });

    it('rejects a duplicate slug with DuplicateProblemError (409)', async () => {
      problems.problems.push(makeProblem({ slug: 'reverse-linked-list' }));
      await expect(service.create(createDto(), admin)).rejects.toBeInstanceOf(
        DuplicateProblemError,
      );
    });
  });

  describe('update — optimistic locking', () => {
    it('applies the update and bumps version when expectedVersion matches', async () => {
      const p = makeProblem();
      problems.problems.push(p);
      const dto = await service.update(
        p.id,
        { expectedVersion: 1, title: 'Two Sum (updated)' },
        admin,
      );
      expect(dto.title).toBe('Two Sum (updated)');
      expect(dto.version).toBe(2);
      expect(problems.versions).toHaveLength(1); // snapshot of v1 archived
    });

    it('throws VersionConflictError (409) when someone updated first', async () => {
      const p = makeProblem({ version: 5 });
      problems.problems.push(p);
      await expect(
        service.update(p.id, { expectedVersion: 4, title: 'stale write' }, admin),
      ).rejects.toBeInstanceOf(VersionConflictError);
    });

    it('404s on unknown problems', async () => {
      await expect(
        service.update('missing', { expectedVersion: 1, title: 'x' }, admin),
      ).rejects.toBeInstanceOf(ProblemNotFoundError);
    });
  });

  describe('soft delete', () => {
    it('marks deletedAt and hides the problem from normal reads', async () => {
      const p = makeProblem();
      problems.problems.push(p);
      await service.softDelete(p.id, admin);
      expect(await problems.findByIdOrSlug(p.id)).toBeNull();
      expect(await problems.findByIdOrSlug(p.id, true)).not.toBeNull();
      expect(audit.entries.map((e) => e.action)).toContain('problem.delete');
    });
  });

  describe('publish / archive', () => {
    it('publish sets visibility PUBLIC and audits', async () => {
      const p = makeProblem({ visibility: ProblemVisibility.DRAFT });
      problems.problems.push(p);
      const dto = await service.publish(p.id, admin);
      expect(dto.visibility).toBe(ProblemVisibility.PUBLIC);
      expect(audit.entries.map((e) => e.action)).toContain('problem.publish');
    });

    it('archive sets visibility ARCHIVED', async () => {
      const p = makeProblem();
      problems.problems.push(p);
      const dto = await service.archive(p.id, admin);
      expect(dto.visibility).toBe(ProblemVisibility.ARCHIVED);
    });
  });

  describe('test cases', () => {
    it('replaces the set and reports the count', async () => {
      const p = makeProblem();
      problems.problems.push(p);
      const count = await service.uploadTestCases(
        p.id,
        {
          mode: 'replace',
          testCases: [
            { input: '1', expectedOutput: '1', isHidden: false, weight: 1 },
            { input: '2', expectedOutput: '2', isHidden: true, weight: 1 },
          ],
        },
        admin,
      );
      expect(count).toBe(2);
      expect(audit.entries.map((e) => e.action)).toContain('problem.testcases.replace');
    });
  });

  describe('cache invalidation', () => {
    it('clears detail + trending keys on update', async () => {
      const p = makeProblem();
      problems.problems.push(p);
      cache.store.set(`problems:detail:id:${p.id}`, '"cached"');
      cache.store.set('problems:trending', '"cached"');
      await service.update(p.id, { expectedVersion: 1, title: 'new title' }, admin);
      expect(cache.store.has(`problems:detail:id:${p.id}`)).toBe(false);
      expect(cache.store.has('problems:trending')).toBe(false);
    });
  });
});
