import type { Company, Prisma, Tag, TestCase } from '@prisma/client';
import type {
  ProblemListOptions,
  ProblemListResult,
  ProblemWithRelations,
  TrendingRow,
} from '../types/problem.types.js';

/**
 * Repository & collaborator contracts. Services depend ONLY on these
 * interfaces (Dependency Inversion): swapping Prisma for something
 * else — or for an in-memory fake in tests — never touches a service.
 */

export interface IProblemRepository {
  findByIdOrSlug(idOrSlug: string, includeDeleted?: boolean): Promise<ProblemWithRelations | null>;
  existsBySlug(slug: string): Promise<boolean>;
  list(options: ProblemListOptions): Promise<ProblemListResult>;
  trending(sinceDaysAgo: number, limit: number): Promise<TrendingRow[]>;
  findManyByIds(ids: string[]): Promise<ProblemListResult['rows']>;
  recentlySolvedProblemIds(userId: string, limit: number): Promise<string[]>;
  create(
    data: Prisma.ProblemCreateInput,
    tagIds: string[],
    companyIds: string[],
  ): Promise<ProblemWithRelations>;
  /**
   * Applies an update + snapshot + version bump in ONE transaction,
   * guarded by the optimistic-lock version.
   */
  updateWithSnapshot(params: {
    problemId: string;
    expectedVersion: number;
    editorId: string;
    data: Prisma.ProblemUpdateInput;
    tagIds?: string[];
    companyIds?: string[];
  }): Promise<ProblemWithRelations>;
  softDelete(problemId: string): Promise<void>;
  replaceTestCases(
    problemId: string,
    testCases: Omit<Prisma.TestCaseCreateManyInput, 'problemId'>[],
  ): Promise<number>;
  listVersions(
    problemId: string,
  ): Promise<{ id: string; version: number; editorId: string | null; createdAt: Date }[]>;
  getVersion(problemId: string, version: number): Promise<{ snapshot: unknown } | null>;
  listTestCases(problemId: string): Promise<TestCase[]>;
}

export interface IBookmarkRepository {
  add(userId: string, problemId: string): Promise<void>;
  remove(userId: string, problemId: string): Promise<boolean>;
  listProblemIds(userId: string): Promise<string[]>;
}

export interface ITaxonomyRepository {
  listTags(): Promise<Tag[]>;
  listCompanies(): Promise<Company[]>;
  upsertTag(name: string, slug: string): Promise<Tag>;
  upsertCompany(name: string, slug: string, logoUrl?: string): Promise<Company>;
  deleteTag(id: string): Promise<boolean>;
  deleteCompany(id: string): Promise<boolean>;
  resolveTagIds(slugs: string[]): Promise<string[]>;
  resolveCompanyIds(slugs: string[]): Promise<string[]>;
}

export interface IAuditLogRepository {
  record(entry: {
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}
