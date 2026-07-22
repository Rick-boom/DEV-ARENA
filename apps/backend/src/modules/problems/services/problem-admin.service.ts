import { Prisma, ProblemVisibility } from '@prisma/client';
import {
  DuplicateProblemError,
  ProblemNotFoundError,
  VersionConflictError,
} from '../../../errors/app-error.js';
import type { ICacheService } from '../../../lib/cache.js';
import { createModuleLogger } from '../../../lib/logger.js';
import { PROBLEM_CONSTANTS } from '../constants/problem.constants.js';
import type {
  IAuditLogRepository,
  IProblemRepository,
  ITaxonomyRepository,
} from '../interfaces/problem.interfaces.js';
import type {
  CreateProblemDto,
  UpdateProblemDto,
  UploadTestCasesDto,
  UpsertEditorialDto,
  UpsertHintsDto,
} from '../dto/problem-request.dto.js';
import {
  toAdminProblemDetailDto,
  type AdminProblemDetailDto,
} from '../dto/problem-response.dto.js';
import type { AuthUser } from '../../../middlewares/auth.middleware.js';

const log = createModuleLogger('problem-admin-service');
const { CACHE } = PROBLEM_CONSTANTS;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Write-side (admin/moderator) use cases. Every mutation:
 *   1. runs through the optimistic-lock snapshot transaction (updates),
 *   2. invalidates the problem's cache entries,
 *   3. records an AdminLog row.
 * Taxonomy slugs are auto-created on write (admin lists tags by name;
 * the vocabulary grows organically but stays normalized).
 */
export class ProblemAdminService {
  constructor(
    private readonly problems: IProblemRepository,
    private readonly taxonomy: ITaxonomyRepository,
    private readonly audit: IAuditLogRepository,
    private readonly cache: ICacheService,
  ) {}

  private async invalidate(problemId: string, slug: string): Promise<void> {
    await this.cache.del(
      CACHE.KEYS.detailById(problemId),
      CACHE.KEYS.detailBySlug(slug),
      CACHE.KEYS.trending,
    );
  }

  private async ensureTaxonomy(tagSlugs: string[], companySlugs: string[]) {
    // Upsert each slug so referencing a new tag creates it — one round
    // trip per new item, only on admin writes (cold path).
    for (const slug of tagSlugs) await this.taxonomy.upsertTag(slug, slug);
    for (const slug of companySlugs) await this.taxonomy.upsertCompany(slug, slug);
    const [tagIds, companyIds] = await Promise.all([
      this.taxonomy.resolveTagIds(tagSlugs),
      this.taxonomy.resolveCompanyIds(companySlugs),
    ]);
    return { tagIds, companyIds };
  }

  async create(dto: CreateProblemDto, actor: AuthUser): Promise<AdminProblemDetailDto> {
    const slug = dto.slug ?? slugify(dto.title);
    if (await this.problems.existsBySlug(slug)) {
      throw new DuplicateProblemError('slug', slug);
    }
    const { tagIds, companyIds } = await this.ensureTaxonomy(dto.tags, dto.companies);

    const created = await this.problems.create(
      {
        slug,
        title: dto.title,
        statement: dto.statement,
        difficulty: dto.difficulty,
        visibility: dto.visibility,
        timeLimitMs: dto.timeLimitMs,
        memoryLimitMb: dto.memoryLimitMb,
        author: { connect: { id: actor.id } },
        examples: {
          create: dto.examples.map((e, order) => ({
            input: e.input,
            output: e.output,
            explanation: e.explanation ?? null,
            order,
          })),
        },
        constraints: {
          create: dto.constraints.map((description, order) => ({ description, order })),
        },
        hints: { create: dto.hints.map((content, order) => ({ content, order })) },
      },
      tagIds,
      companyIds,
    );

    await this.audit.record({
      actorId: actor.id,
      action: 'problem.create',
      targetType: 'problem',
      targetId: created.id,
      metadata: { slug, difficulty: dto.difficulty },
    });
    log.info({ problemId: created.id, slug }, 'problem created');
    return toAdminProblemDetailDto(created);
  }

  async update(
    idOrSlug: string,
    dto: UpdateProblemDto,
    actor: AuthUser,
  ): Promise<AdminProblemDetailDto> {
    const existing = await this.problems.findByIdOrSlug(idOrSlug);
    if (!existing) throw new ProblemNotFoundError(idOrSlug);

    if (dto.slug && dto.slug !== existing.slug && (await this.problems.existsBySlug(dto.slug))) {
      throw new DuplicateProblemError('slug', dto.slug);
    }

    let tagIds: string[] | undefined;
    let companyIds: string[] | undefined;
    if (dto.tags || dto.companies) {
      const resolved = await this.ensureTaxonomy(dto.tags ?? [], dto.companies ?? []);
      tagIds = dto.tags ? resolved.tagIds : undefined;
      companyIds = dto.companies ? resolved.companyIds : undefined;
    }

    const data: Prisma.ProblemUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
      ...(dto.statement !== undefined ? { statement: dto.statement } : {}),
      ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
      ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      ...(dto.timeLimitMs !== undefined ? { timeLimitMs: dto.timeLimitMs } : {}),
      ...(dto.memoryLimitMb !== undefined ? { memoryLimitMb: dto.memoryLimitMb } : {}),
      ...(dto.examples !== undefined
        ? {
            examples: {
              deleteMany: {},
              create: dto.examples.map((e, order) => ({
                input: e.input,
                output: e.output,
                explanation: e.explanation ?? null,
                order,
              })),
            },
          }
        : {}),
      ...(dto.constraints !== undefined
        ? {
            constraints: {
              deleteMany: {},
              create: dto.constraints.map((description, order) => ({ description, order })),
            },
          }
        : {}),
      ...(dto.hints !== undefined
        ? {
            hints: {
              deleteMany: {},
              create: dto.hints.map((content, order) => ({ content, order })),
            },
          }
        : {}),
    };

    try {
      const updated = await this.problems.updateWithSnapshot({
        problemId: existing.id,
        expectedVersion: dto.expectedVersion,
        editorId: actor.id,
        data,
        tagIds,
        companyIds,
      });
      await this.invalidate(existing.id, existing.slug);
      await this.audit.record({
        actorId: actor.id,
        action: 'problem.update',
        targetType: 'problem',
        targetId: existing.id,
        metadata: { fields: Object.keys(dto).filter((k) => k !== 'expectedVersion') },
      });
      return toAdminProblemDetailDto(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        const current = (err.meta as { currentVersion?: number } | undefined)?.currentVersion;
        throw new VersionConflictError(dto.expectedVersion, current ?? -1);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ProblemNotFoundError(idOrSlug);
      }
      throw err;
    }
  }

  async softDelete(idOrSlug: string, actor: AuthUser): Promise<void> {
    const existing = await this.problems.findByIdOrSlug(idOrSlug);
    if (!existing) throw new ProblemNotFoundError(idOrSlug);
    await this.problems.softDelete(existing.id);
    await this.invalidate(existing.id, existing.slug);
    await this.audit.record({
      actorId: actor.id,
      action: 'problem.delete',
      targetType: 'problem',
      targetId: existing.id,
      metadata: { slug: existing.slug, soft: true },
    });
    log.info({ problemId: existing.id }, 'problem soft-deleted');
  }

  private async setVisibility(
    idOrSlug: string,
    visibility: ProblemVisibility,
    action: string,
    actor: AuthUser,
  ): Promise<AdminProblemDetailDto> {
    const existing = await this.problems.findByIdOrSlug(idOrSlug);
    if (!existing) throw new ProblemNotFoundError(idOrSlug);
    const updated = await this.problems.updateWithSnapshot({
      problemId: existing.id,
      expectedVersion: existing.version,
      editorId: actor.id,
      data: { visibility },
    });
    await this.invalidate(existing.id, existing.slug);
    await this.audit.record({
      actorId: actor.id,
      action,
      targetType: 'problem',
      targetId: existing.id,
    });
    return toAdminProblemDetailDto(updated);
  }

  publish(idOrSlug: string, actor: AuthUser): Promise<AdminProblemDetailDto> {
    return this.setVisibility(idOrSlug, ProblemVisibility.PUBLIC, 'problem.publish', actor);
  }

  archive(idOrSlug: string, actor: AuthUser): Promise<AdminProblemDetailDto> {
    return this.setVisibility(idOrSlug, ProblemVisibility.ARCHIVED, 'problem.archive', actor);
  }

  async getAdminDetail(idOrSlug: string): Promise<AdminProblemDetailDto> {
    const problem = await this.problems.findByIdOrSlug(idOrSlug, true);
    if (!problem) throw new ProblemNotFoundError(idOrSlug);
    return toAdminProblemDetailDto(problem);
  }

  async uploadTestCases(
    idOrSlug: string,
    dto: UploadTestCasesDto,
    actor: AuthUser,
  ): Promise<number> {
    const existing = await this.problems.findByIdOrSlug(idOrSlug);
    if (!existing) throw new ProblemNotFoundError(idOrSlug);
    const count = await this.problems.replaceTestCases(existing.id, dto.testCases);
    await this.invalidate(existing.id, existing.slug);
    await this.audit.record({
      actorId: actor.id,
      action: 'problem.testcases.replace',
      targetType: 'problem',
      targetId: existing.id,
      metadata: { count },
    });
    return count;
  }

  async upsertEditorial(
    idOrSlug: string,
    dto: UpsertEditorialDto,
    actor: AuthUser,
  ): Promise<AdminProblemDetailDto> {
    const existing = await this.problems.findByIdOrSlug(idOrSlug);
    if (!existing) throw new ProblemNotFoundError(idOrSlug);
    const updated = await this.problems.updateWithSnapshot({
      problemId: existing.id,
      expectedVersion: existing.version,
      editorId: actor.id,
      data: {
        editorial: {
          upsert: {
            create: {
              content: dto.content,
              timeComplexity: dto.timeComplexity ?? null,
              spaceComplexity: dto.spaceComplexity ?? null,
            },
            update: {
              content: dto.content,
              timeComplexity: dto.timeComplexity ?? null,
              spaceComplexity: dto.spaceComplexity ?? null,
            },
          },
        },
      },
    });
    await this.invalidate(existing.id, existing.slug);
    await this.audit.record({
      actorId: actor.id,
      action: 'problem.editorial.upsert',
      targetType: 'problem',
      targetId: existing.id,
    });
    return toAdminProblemDetailDto(updated);
  }

  async upsertHints(
    idOrSlug: string,
    dto: UpsertHintsDto,
    actor: AuthUser,
  ): Promise<AdminProblemDetailDto> {
    const existing = await this.problems.findByIdOrSlug(idOrSlug);
    if (!existing) throw new ProblemNotFoundError(idOrSlug);
    const updated = await this.problems.updateWithSnapshot({
      problemId: existing.id,
      expectedVersion: existing.version,
      editorId: actor.id,
      data: {
        hints: {
          deleteMany: {},
          create: dto.hints.map((content, order) => ({ content, order })),
        },
      },
    });
    await this.invalidate(existing.id, existing.slug);
    await this.audit.record({
      actorId: actor.id,
      action: 'problem.hints.upsert',
      targetType: 'problem',
      targetId: existing.id,
      metadata: { count: dto.hints.length },
    });
    return toAdminProblemDetailDto(updated);
  }

  async listVersions(idOrSlug: string) {
    const existing = await this.problems.findByIdOrSlug(idOrSlug, true);
    if (!existing) throw new ProblemNotFoundError(idOrSlug);
    return this.problems.listVersions(existing.id);
  }

  async getVersion(idOrSlug: string, version: number) {
    const existing = await this.problems.findByIdOrSlug(idOrSlug, true);
    if (!existing) throw new ProblemNotFoundError(idOrSlug);
    const snapshot = await this.problems.getVersion(existing.id, version);
    if (!snapshot) throw new ProblemNotFoundError(`${idOrSlug}@v${version}`);
    return { problemId: existing.id, version, snapshot: snapshot.snapshot };
  }
}
