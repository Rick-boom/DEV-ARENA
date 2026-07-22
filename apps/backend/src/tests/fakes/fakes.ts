import { Difficulty, ProblemVisibility } from '@prisma/client';
import type { ICacheService } from '../../lib/cache.js';
import type {
  IAuditLogRepository,
  IBookmarkRepository,
  IProblemRepository,
  ITaxonomyRepository,
} from '../../modules/problems/interfaces/problem.interfaces.js';
import type {
  ProblemListRow,
  ProblemWithRelations,
} from '../../modules/problems/types/problem.types.js';

/**
 * Hand-rolled in-memory fakes. Because services depend on interfaces
 * (DI), a complete fake fits in a few dozen lines — no mocking
 * library gymnastics, and the fakes behave consistently across every
 * test file.
 */

export function makeProblem(overrides: Partial<ProblemWithRelations> = {}): ProblemWithRelations {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'two-sum',
    title: 'Two Sum',
    statement: 'Given an array of integers, return indices of two numbers adding to target.',
    difficulty: Difficulty.EASY,
    visibility: ProblemVisibility.PUBLIC,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    solvedCount: 50,
    submissionCount: 100,
    authorId: null,
    version: 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    tags: [],
    companies: [],
    examples: [],
    constraints: [],
    hints: [],
    editorial: null,
    testCases: [
      {
        id: 'tc-visible',
        problemId: '11111111-1111-4111-8111-111111111111',
        input: '1 2',
        expectedOutput: '3',
        isHidden: false,
        weight: 1,
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tc-hidden',
        problemId: '11111111-1111-4111-8111-111111111111',
        input: 'SECRET',
        expectedOutput: 'SECRET',
        isHidden: true,
        weight: 1,
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  };
}

export class FakeCache implements ICacheService {
  store = new Map<string, string>();
  async getJson<T>(key: string): Promise<T | null> {
    const raw = this.store.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async setJson(key: string, value: unknown): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }
  async del(...keys: string[]): Promise<void> {
    keys.forEach((k) => this.store.delete(k));
  }
}

export class FakeProblemRepository implements IProblemRepository {
  problems: ProblemWithRelations[] = [];
  solvedByUser = new Map<string, string[]>();
  versions: { problemId: string; version: number; snapshot: unknown }[] = [];

  async findByIdOrSlug(idOrSlug: string, includeDeleted = false) {
    const p = this.problems.find((x) => x.id === idOrSlug || x.slug === idOrSlug) ?? null;
    if (p && p.deletedAt && !includeDeleted) return null;
    return p;
  }
  async existsBySlug(slug: string) {
    return this.problems.some((p) => p.slug === slug);
  }
  async list() {
    const rows = this.problems.filter((p) => !p.deletedAt) as ProblemListRow[];
    return {
      rows,
      total: rows.length,
      solvedIds: new Set<string>(),
      bookmarkedIds: new Set<string>(),
    };
  }
  async trending() {
    return this.problems.map((p) => ({ problemId: p.id, recentSubmissions: 10 }));
  }
  async findManyByIds(ids: string[]) {
    return this.problems.filter((p) => ids.includes(p.id) && !p.deletedAt) as ProblemListRow[];
  }
  async recentlySolvedProblemIds(userId: string) {
    return this.solvedByUser.get(userId) ?? [];
  }
  async create(data: never, _tagIds: string[], _companyIds: string[]) {
    // Translate the Prisma create input (nested writes) into the flat
    // fake shape: scalars spread through, relations map from `create`.
    const d = data as Record<string, unknown>;
    const nested = <T>(key: string): T[] =>
      ((d[key] as { create?: T[] } | undefined)?.create ?? []) as T[];
    const id = crypto.randomUUID();
    const now = new Date();
    const p = makeProblem({
      id,
      slug: d.slug as string,
      title: d.title as string,
      statement: d.statement as string,
      difficulty: d.difficulty as never,
      visibility: d.visibility as never,
      timeLimitMs: (d.timeLimitMs as number) ?? 2000,
      memoryLimitMb: (d.memoryLimitMb as number) ?? 256,
      solvedCount: 0,
      submissionCount: 0,
      testCases: [],
      examples: nested<{
        input: string;
        output: string;
        explanation: string | null;
        order: number;
      }>('examples').map((e, i) => ({
        ...e,
        id: `ex-${i}`,
        problemId: id,
        createdAt: now,
        updatedAt: now,
      })),
      constraints: nested<{ description: string; order: number }>('constraints').map((c, i) => ({
        ...c,
        id: `con-${i}`,
        problemId: id,
        createdAt: now,
        updatedAt: now,
      })),
      hints: nested<{ content: string; order: number }>('hints').map((h, i) => ({
        ...h,
        id: `hint-${i}`,
        problemId: id,
        createdAt: now,
        updatedAt: now,
      })),
    });
    this.problems.push(p);
    return p;
  }
  async updateWithSnapshot(params: {
    problemId: string;
    expectedVersion: number;
    data: Record<string, unknown>;
  }) {
    const p = this.problems.find((x) => x.id === params.problemId);
    if (!p) throw new Error('not found');
    if (p.version !== params.expectedVersion) {
      const { Prisma } = await import('@prisma/client');
      throw new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: 'test',
        meta: { currentVersion: p.version },
      });
    }
    this.versions.push({ problemId: p.id, version: p.version, snapshot: { title: p.title } });
    Object.assign(
      p,
      Object.fromEntries(
        Object.entries(params.data).filter(([, v]) => typeof v !== 'object' || v === null),
      ),
    );
    p.version += 1;
    return p;
  }
  async softDelete(problemId: string) {
    const p = this.problems.find((x) => x.id === problemId);
    if (p) p.deletedAt = new Date();
  }
  async replaceTestCases(_problemId: string, testCases: unknown[]) {
    return testCases.length;
  }
  async listVersions(problemId: string) {
    return this.versions
      .filter((v) => v.problemId === problemId)
      .map((v, i) => ({ id: `v-${i}`, version: v.version, editorId: null, createdAt: new Date() }));
  }
  async getVersion(problemId: string, version: number) {
    const v = this.versions.find((x) => x.problemId === problemId && x.version === version);
    return v ? { snapshot: v.snapshot } : null;
  }
  async listTestCases() {
    return [];
  }
}

export class FakeBookmarkRepository implements IBookmarkRepository {
  byUser = new Map<string, Set<string>>();
  async add(userId: string, problemId: string) {
    if (!this.byUser.has(userId)) this.byUser.set(userId, new Set());
    this.byUser.get(userId)!.add(problemId);
  }
  async remove(userId: string, problemId: string) {
    return this.byUser.get(userId)?.delete(problemId) ?? false;
  }
  async listProblemIds(userId: string) {
    return [...(this.byUser.get(userId) ?? [])];
  }
}

export class FakeTaxonomyRepository implements ITaxonomyRepository {
  tags = new Map<
    string,
    { id: string; name: string; slug: string; createdAt: Date; updatedAt: Date }
  >();
  companies = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();

  async listTags() {
    return [...this.tags.values()];
  }
  async listCompanies() {
    return [...this.companies.values()];
  }
  async upsertTag(name: string, slug: string) {
    const existing = this.tags.get(slug);
    const tag = existing
      ? { ...existing, name }
      : { id: crypto.randomUUID(), name, slug, createdAt: new Date(), updatedAt: new Date() };
    this.tags.set(slug, tag);
    return tag;
  }
  async upsertCompany(name: string, slug: string, logoUrl?: string) {
    const existing = this.companies.get(slug);
    const company = existing
      ? { ...existing, name, logoUrl: logoUrl ?? existing.logoUrl }
      : {
          id: crypto.randomUUID(),
          name,
          slug,
          logoUrl: logoUrl ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
    this.companies.set(slug, company);
    return company;
  }
  async deleteTag(id: string) {
    for (const [slug, t] of this.tags) if (t.id === id) return this.tags.delete(slug);
    return false;
  }
  async deleteCompany(id: string) {
    for (const [slug, c] of this.companies) if (c.id === id) return this.companies.delete(slug);
    return false;
  }
  async resolveTagIds(slugs: string[]) {
    return slugs.map((s) => this.tags.get(s)?.id).filter((x): x is string => Boolean(x));
  }
  async resolveCompanyIds(slugs: string[]) {
    return slugs.map((s) => this.companies.get(s)?.id).filter((x): x is string => Boolean(x));
  }
}

export class FakeAuditLog implements IAuditLogRepository {
  entries: { action: string; targetId?: string }[] = [];
  async record(entry: { action: string; targetId?: string }) {
    this.entries.push(entry);
  }
}
