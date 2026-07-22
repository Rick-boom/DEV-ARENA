import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Difficulty, ProblemVisibility, SubmissionStatus, type PrismaClient } from '@prisma/client';
import { ProblemRepository } from '../../modules/problems/repositories/problem.repository.js';

/**
 * Repository tests with a mocked PrismaClient: we assert the SQL-
 * shaping logic (where clauses, soft-delete filters, ordering, the
 * optimistic-lock guard) without a live database. The real SQL round-
 * trip is covered by prisma validate + integration environments.
 */
function mockPrisma() {
  return {
    problem: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    submission: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    bookmark: { findMany: vi.fn().mockResolvedValue([]) },
    problemVersion: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    problemTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    problemCompany: { deleteMany: vi.fn(), createMany: vi.fn() },
    testCase: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

describe('ProblemRepository', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let repo: ProblemRepository;

  beforeEach(() => {
    prisma = mockPrisma();
    // Array form of $transaction: just await both queries.
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prisma);
      return arg;
    });
    repo = new ProblemRepository(prisma as unknown as PrismaClient);
  });

  describe('findByIdOrSlug', () => {
    it('queries by id for UUIDs and excludes soft-deleted rows', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);
      await repo.findByIdOrSlug('11111111-1111-4111-8111-111111111111');
      const where = prisma.problem.findFirst.mock.calls[0]?.[0]?.where;
      expect(where.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(where.slug).toBeUndefined();
      expect(where.deletedAt).toBeNull();
    });

    it('queries by slug for non-UUID input', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);
      await repo.findByIdOrSlug('two-sum');
      const where = prisma.problem.findFirst.mock.calls[0]?.[0]?.where;
      expect(where.slug).toBe('two-sum');
      expect(where.id).toBeUndefined();
    });

    it('includes soft-deleted rows only when asked (admin path)', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);
      await repo.findByIdOrSlug('two-sum', true);
      const where = prisma.problem.findFirst.mock.calls[0]?.[0]?.where;
      expect('deletedAt' in where).toBe(false);
    });
  });

  describe('list — where-clause construction', () => {
    const baseOptions = {
      page: 2,
      pageSize: 10,
      sortBy: 'newest' as const,
      filters: {},
      visibleVisibilities: [ProblemVisibility.PUBLIC],
    };

    it('always applies soft-delete + visibility filters and paginates', async () => {
      await repo.list(baseOptions);
      const call = prisma.problem.findMany.mock.calls[0]?.[0];
      expect(call.where.deletedAt).toBeNull();
      expect(call.where.visibility).toEqual({ in: [ProblemVisibility.PUBLIC] });
      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
      expect(call.orderBy).toEqual([{ createdAt: 'desc' }]);
    });

    it('maps difficulty, tag and company filters', async () => {
      await repo.list({
        ...baseOptions,
        filters: { difficulty: Difficulty.HARD, tags: ['dp'], companies: ['google'] },
      });
      const where = prisma.problem.findMany.mock.calls[0]?.[0]?.where;
      expect(where.difficulty).toBe(Difficulty.HARD);
      expect(where.tags.some.tag.slug).toEqual({ in: ['dp'] });
      expect(where.companies.some.company.slug).toEqual({ in: ['google'] });
    });

    it('builds a keyword OR across title/statement/tags/companies', async () => {
      await repo.list({ ...baseOptions, filters: { q: 'array' } });
      const where = prisma.problem.findMany.mock.calls[0]?.[0]?.where;
      expect(where.OR).toHaveLength(4);
      expect(where.OR[0].title.contains).toBe('array');
      expect(where.OR[0].title.mode).toBe('insensitive');
    });

    it('applies solved filter only when a viewer is present', async () => {
      await repo.list({ ...baseOptions, filters: { solved: true } }); // no viewer
      let where = prisma.problem.findMany.mock.calls[0]?.[0]?.where;
      expect(where.submissions).toBeUndefined();

      await repo.list({ ...baseOptions, filters: { solved: true }, viewerId: 'u1' });
      where = prisma.problem.findMany.mock.calls[1]?.[0]?.where;
      expect(where.submissions.some).toEqual({
        userId: 'u1',
        status: SubmissionStatus.ACCEPTED,
      });
    });

    it('uses the raw-SQL path for acceptance sorting', async () => {
      prisma.problem.findMany.mockResolvedValueOnce([{ id: 'a' }]); // candidate ids
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'a' }]);
      prisma.problem.findMany.mockResolvedValueOnce([]); // hydration
      await repo.list({ ...baseOptions, sortBy: 'acceptance' });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateWithSnapshot — optimistic lock', () => {
    it('throws P2034 with currentVersion when the guard update matches 0 rows', async () => {
      prisma.problem.findUnique.mockResolvedValue({
        id: 'p1',
        version: 7,
        deletedAt: null,
        tags: [],
        companies: [],
        examples: [],
        constraints: [],
        hints: [],
        editorial: null,
        testCases: [],
      });
      prisma.problem.updateMany.mockResolvedValue({ count: 0 }); // someone else won

      await expect(
        repo.updateWithSnapshot({
          problemId: 'p1',
          expectedVersion: 6,
          editorId: 'admin',
          data: { title: 'stale' },
        }),
      ).rejects.toMatchObject({ code: 'P2034', meta: { currentVersion: 7 } });
      expect(prisma.problemVersion.create).not.toHaveBeenCalled();
    });

    it('snapshots the PRE-update state, then applies the update', async () => {
      const current = {
        id: 'p1',
        slug: 'two-sum',
        title: 'Old Title',
        statement: 's',
        difficulty: Difficulty.EASY,
        visibility: ProblemVisibility.PUBLIC,
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        version: 3,
        deletedAt: null,
        tags: [],
        companies: [],
        examples: [],
        constraints: [],
        hints: [],
        editorial: null,
        testCases: [],
      };
      prisma.problem.findUnique.mockResolvedValue(current);
      prisma.problem.updateMany.mockResolvedValue({ count: 1 });
      prisma.problem.findUniqueOrThrow.mockResolvedValue({ ...current, title: 'New', version: 4 });

      const updated = await repo.updateWithSnapshot({
        problemId: 'p1',
        expectedVersion: 3,
        editorId: 'admin',
        data: { title: 'New' },
      });

      const snapshotArg = prisma.problemVersion.create.mock.calls[0]?.[0]?.data;
      expect(snapshotArg.version).toBe(3);
      expect(snapshotArg.snapshot.title).toBe('Old Title'); // pre-update state
      expect(updated.title).toBe('New');
    });
  });

  describe('trending', () => {
    it('groups submissions since the window start, ordered by count', async () => {
      prisma.submission.groupBy.mockResolvedValue([{ problemId: 'a', _count: { problemId: 12 } }]);
      const rows = await repo.trending(7, 20);
      const call = prisma.submission.groupBy.mock.calls[0]?.[0];
      expect(call.by).toEqual(['problemId']);
      expect(call.take).toBe(20);
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
      expect(rows[0]).toEqual({ problemId: 'a', recentSubmissions: 12 });
    });
  });

  describe('findManyByIds', () => {
    it('preserves the caller-provided ranking order', async () => {
      prisma.problem.findMany.mockResolvedValue([{ id: 'b' }, { id: 'a' }]);
      const rows = await repo.findManyByIds(['a', 'b']);
      expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    });
  });
});
