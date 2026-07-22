import { Prisma, SubmissionStatus, type PrismaClient, type TestCase } from '@prisma/client';
import type { IProblemRepository } from '../interfaces/problem.interfaces.js';
import type {
  ProblemListOptions,
  ProblemListResult,
  ProblemWithRelations,
  TrendingRow,
} from '../types/problem.types.js';

const LIST_INCLUDE = {
  tags: { include: { tag: true } },
  companies: { include: { company: true } },
} satisfies Prisma.ProblemInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  examples: true,
  constraints: true,
  hints: true,
  editorial: true,
  testCases: true,
} satisfies Prisma.ProblemInclude;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * All Problem SQL lives here and nowhere else. Notable decisions:
 * • idOrSlug resolution (uuid vs slug) is a repo concern — callers
 *   pass whatever the URL contained.
 * • Soft delete is enforced in every read via `deletedAt: null`.
 * • Acceptance-rate sorting needs a computed expression, which Prisma
 *   orderBy cannot express — so that one path uses a raw, parameterized
 *   query for the ID page, then hydrates via findMany. Two indexed
 *   queries, still safe from injection (Prisma.sql tagged template).
 * • Update+snapshot+version-bump is a single interactive transaction
 *   with an optimistic-lock guard (updateMany WHERE version = expected).
 */
export class ProblemRepository implements IProblemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdOrSlug(
    idOrSlug: string,
    includeDeleted = false,
  ): Promise<ProblemWithRelations | null> {
    const where: Prisma.ProblemWhereInput = UUID_RE.test(idOrSlug)
      ? { id: idOrSlug }
      : { slug: idOrSlug };
    if (!includeDeleted) where.deletedAt = null;
    return this.prisma.problem.findFirst({ where, include: DETAIL_INCLUDE });
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const found = await this.prisma.problem.findUnique({ where: { slug }, select: { id: true } });
    return found !== null;
  }

  private buildListWhere(options: ProblemListOptions): Prisma.ProblemWhereInput {
    const { filters, viewerId, visibleVisibilities } = options;
    const where: Prisma.ProblemWhereInput = {
      deletedAt: null,
      visibility: { in: visibleVisibilities },
    };

    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.tags?.length) {
      where.tags = { some: { tag: { slug: { in: filters.tags } } } };
    }
    if (filters.companies?.length) {
      where.companies = { some: { company: { slug: { in: filters.companies } } } };
    }
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { statement: { contains: filters.q, mode: 'insensitive' } },
        { tags: { some: { tag: { name: { contains: filters.q, mode: 'insensitive' } } } } },
        {
          companies: { some: { company: { name: { contains: filters.q, mode: 'insensitive' } } } },
        },
      ];
    }
    if (viewerId !== undefined) {
      if (filters.solved === true) {
        where.submissions = { some: { userId: viewerId, status: SubmissionStatus.ACCEPTED } };
      } else if (filters.solved === false) {
        where.submissions = { none: { userId: viewerId, status: SubmissionStatus.ACCEPTED } };
      }
      if (filters.bookmarked === true) {
        where.bookmarks = { some: { userId: viewerId } };
      }
    }
    return where;
  }

  private buildOrderBy(
    sortBy: ProblemListOptions['sortBy'],
  ): Prisma.ProblemOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'oldest':
        return [{ createdAt: 'asc' }];
      case 'difficulty':
        return [{ difficulty: 'asc' }, { createdAt: 'desc' }];
      case 'newest':
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  async list(options: ProblemListOptions): Promise<ProblemListResult> {
    const where = this.buildListWhere(options);
    const skip = (options.page - 1) * options.pageSize;

    let rows: ProblemListResult['rows'];
    let total: number;

    if (options.sortBy === 'acceptance') {
      // Raw path: ORDER BY solved/submissions expression. Filter set is
      // re-applied via the id list from a Prisma count+findMany pair to
      // keep the raw SQL minimal: fetch candidate ids matching `where`
      // first (indexed), then order that page in SQL.
      const candidateIds = (
        await this.prisma.problem.findMany({ where, select: { id: true } })
      ).map((r) => r.id);
      total = candidateIds.length;
      if (total === 0) {
        return { rows: [], total: 0, solvedIds: new Set(), bookmarkedIds: new Set() };
      }
      const ordered = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM problems
        WHERE id IN (${Prisma.join(candidateIds)})
        ORDER BY CASE WHEN submission_count = 0 THEN 0
                      ELSE solved_count::float / submission_count END DESC,
                 created_at DESC
        LIMIT ${options.pageSize} OFFSET ${skip}
      `);
      rows = await this.findManyByIds(ordered.map((r) => r.id));
    } else {
      [rows, total] = await this.prisma.$transaction([
        this.prisma.problem.findMany({
          where,
          include: LIST_INCLUDE,
          orderBy: this.buildOrderBy(options.sortBy),
          skip,
          take: options.pageSize,
        }),
        this.prisma.problem.count({ where }),
      ]);
    }

    const [solvedIds, bookmarkedIds] = await this.viewerFlags(
      options.viewerId,
      rows.map((r) => r.id),
    );
    return { rows, total, solvedIds, bookmarkedIds };
  }

  private async viewerFlags(
    viewerId: string | undefined,
    problemIds: string[],
  ): Promise<[Set<string>, Set<string>]> {
    if (!viewerId || problemIds.length === 0) return [new Set(), new Set()];
    const [solved, bookmarked] = await Promise.all([
      this.prisma.submission.findMany({
        where: {
          userId: viewerId,
          problemId: { in: problemIds },
          status: SubmissionStatus.ACCEPTED,
        },
        select: { problemId: true },
        distinct: ['problemId'],
      }),
      this.prisma.bookmark.findMany({
        where: { userId: viewerId, problemId: { in: problemIds } },
        select: { problemId: true },
      }),
    ]);
    return [new Set(solved.map((s) => s.problemId)), new Set(bookmarked.map((b) => b.problemId))];
  }

  async trending(sinceDaysAgo: number, limit: number): Promise<TrendingRow[]> {
    const since = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.submission.groupBy({
      by: ['problemId'],
      where: { createdAt: { gte: since } },
      _count: { problemId: true },
      orderBy: { _count: { problemId: 'desc' } },
      take: limit,
    });
    return grouped.map((g) => ({ problemId: g.problemId, recentSubmissions: g._count.problemId }));
  }

  async findManyByIds(ids: string[]): Promise<ProblemListResult['rows']> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.problem.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: LIST_INCLUDE,
    });
    // preserve caller's ordering (trending rank / acceptance rank)
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r));
  }

  async recentlySolvedProblemIds(userId: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.submission.findMany({
      where: { userId, status: SubmissionStatus.ACCEPTED },
      orderBy: { createdAt: 'desc' },
      select: { problemId: true },
      distinct: ['problemId'],
      take: limit,
    });
    return rows.map((r) => r.problemId);
  }

  async create(
    data: Prisma.ProblemCreateInput,
    tagIds: string[],
    companyIds: string[],
  ): Promise<ProblemWithRelations> {
    return this.prisma.problem.create({
      data: {
        ...data,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        companies: { create: companyIds.map((companyId) => ({ companyId })) },
      },
      include: DETAIL_INCLUDE,
    });
  }

  async updateWithSnapshot(params: {
    problemId: string;
    expectedVersion: number;
    editorId: string;
    data: Prisma.ProblemUpdateInput;
    tagIds?: string[];
    companyIds?: string[];
  }): Promise<ProblemWithRelations> {
    const { problemId, expectedVersion, editorId, data, tagIds, companyIds } = params;

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.problem.findUnique({
        where: { id: problemId },
        include: DETAIL_INCLUDE,
      });
      if (!current || current.deletedAt) {
        throw new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: 'app',
        });
      }
      // Optimistic lock: bump only if nobody moved the version under us.
      const guarded = await tx.problem.updateMany({
        where: { id: problemId, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (guarded.count === 0) {
        throw new Prisma.PrismaClientKnownRequestError('Version conflict', {
          code: 'P2034', // transaction conflict — service maps to 409
          clientVersion: 'app',
          meta: { currentVersion: current.version },
        });
      }

      // Snapshot the PRE-update state so version N archives what N looked like.
      await tx.problemVersion.create({
        data: {
          problemId,
          version: current.version,
          editorId,
          snapshot: {
            slug: current.slug,
            title: current.title,
            statement: current.statement,
            difficulty: current.difficulty,
            visibility: current.visibility,
            timeLimitMs: current.timeLimitMs,
            memoryLimitMb: current.memoryLimitMb,
            tags: current.tags.map((t) => t.tag.slug),
            companies: current.companies.map((c) => c.company.slug),
            examples: current.examples.map((e) => ({
              input: e.input,
              output: e.output,
              explanation: e.explanation,
              order: e.order,
            })),
            constraints: current.constraints.map((c) => ({
              description: c.description,
              order: c.order,
            })),
            hints: current.hints.map((h) => ({ content: h.content, order: h.order })),
            editorial: current.editorial
              ? {
                  content: current.editorial.content,
                  timeComplexity: current.editorial.timeComplexity,
                  spaceComplexity: current.editorial.spaceComplexity,
                }
              : null,
          } satisfies Prisma.InputJsonValue,
        },
      });

      if (tagIds) {
        await tx.problemTag.deleteMany({ where: { problemId } });
        if (tagIds.length) {
          await tx.problemTag.createMany({ data: tagIds.map((tagId) => ({ problemId, tagId })) });
        }
      }
      if (companyIds) {
        await tx.problemCompany.deleteMany({ where: { problemId } });
        if (companyIds.length) {
          await tx.problemCompany.createMany({
            data: companyIds.map((companyId) => ({ problemId, companyId })),
          });
        }
      }

      await tx.problem.update({ where: { id: problemId }, data });

      const updated = await tx.problem.findUniqueOrThrow({
        where: { id: problemId },
        include: DETAIL_INCLUDE,
      });
      return updated;
    });
  }

  async softDelete(problemId: string): Promise<void> {
    await this.prisma.problem.update({
      where: { id: problemId },
      data: { deletedAt: new Date() },
    });
  }

  async replaceTestCases(
    problemId: string,
    testCases: Omit<Prisma.TestCaseCreateManyInput, 'problemId'>[],
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.testCase.deleteMany({ where: { problemId } });
      const created = await tx.testCase.createMany({
        data: testCases.map((tc, index) => ({ ...tc, problemId, order: index })),
      });
      return created.count;
    });
  }

  async listVersions(problemId: string) {
    return this.prisma.problemVersion.findMany({
      where: { problemId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, editorId: true, createdAt: true },
    });
  }

  async getVersion(problemId: string, version: number): Promise<{ snapshot: unknown } | null> {
    return this.prisma.problemVersion.findUnique({
      where: { problemId_version: { problemId, version } },
      select: { snapshot: true },
    });
  }

  async listTestCases(problemId: string): Promise<TestCase[]> {
    return this.prisma.testCase.findMany({ where: { problemId }, orderBy: { order: 'asc' } });
  }
}
