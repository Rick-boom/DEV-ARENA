import { ProblemVisibility, Role } from '@prisma/client';
import type { Paginated } from '@devarena/shared-types';
import { ProblemNotFoundError, ForbiddenError } from '../../../errors/app-error.js';
import type { ICacheService } from '../../../lib/cache.js';
import { createModuleLogger } from '../../../lib/logger.js';
import { PROBLEM_CONSTANTS } from '../constants/problem.constants.js';
import type { IBookmarkRepository, IProblemRepository } from '../interfaces/problem.interfaces.js';
import type { ListProblemsQueryDto } from '../dto/problem-request.dto.js';
import {
  toProblemDetailDto,
  toProblemSummaryDto,
  type ProblemDetailDto,
  type ProblemSummaryDto,
} from '../dto/problem-response.dto.js';
import type { AuthUser } from '../../../middlewares/auth.middleware.js';

const log = createModuleLogger('problem-service');
const { CACHE, TRENDING, RECENTLY_SOLVED_SIZE } = PROBLEM_CONSTANTS;

/**
 * Read-side use cases for regular users. All authorization that
 * depends on DATA (visibility × role) lives here, not in middleware —
 * middleware can only see the route, the service sees the problem.
 */
export class ProblemService {
  constructor(
    private readonly problems: IProblemRepository,
    private readonly bookmarks: IBookmarkRepository,
    private readonly cache: ICacheService,
  ) {}

  /** Which visibilities a viewer's role may see in public listings. */
  private visibleVisibilities(viewer?: AuthUser): ProblemVisibility[] {
    if (viewer && (viewer.role === Role.ADMIN || viewer.role === Role.MODERATOR)) {
      return [
        ProblemVisibility.PUBLIC,
        ProblemVisibility.PREMIUM,
        ProblemVisibility.DRAFT,
        ProblemVisibility.ARCHIVED,
      ];
    }
    // PREMIUM problems are LISTED to everyone (discovery/upsell);
    // the detail endpoint gates the content itself.
    return [ProblemVisibility.PUBLIC, ProblemVisibility.PREMIUM];
  }

  async list(
    query: ListProblemsQueryDto,
    viewer?: AuthUser,
  ): Promise<Paginated<ProblemSummaryDto>> {
    const filters = {
      difficulty: query.difficulty,
      tags: query.tags,
      companies: query.companies,
      q: query.q,
      // solved/bookmarked filters only make sense for a known viewer
      solved: viewer ? query.solved : undefined,
      bookmarked: viewer ? query.bookmarked : undefined,
    };
    const result = await this.problems.list({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      filters,
      viewerId: viewer?.id,
      visibleVisibilities: this.visibleVisibilities(viewer),
    });
    return {
      items: result.rows.map((row) =>
        toProblemSummaryDto(row, {
          solvedIds: result.solvedIds,
          bookmarkedIds: result.bookmarkedIds,
        }),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
  }

  async getByIdOrSlug(idOrSlug: string, viewer?: AuthUser): Promise<ProblemDetailDto> {
    const problem = await this.problems.findByIdOrSlug(idOrSlug);
    if (!problem) throw new ProblemNotFoundError(idOrSlug);

    const isStaff = viewer?.role === Role.ADMIN || viewer?.role === Role.MODERATOR;
    if (problem.visibility === ProblemVisibility.DRAFT && !isStaff) {
      // Drafts are invisible — 404, not 403, so their existence leaks nothing.
      throw new ProblemNotFoundError(idOrSlug);
    }
    if (problem.visibility === ProblemVisibility.PREMIUM) {
      const isPremium = viewer && (viewer.role === Role.PREMIUM || isStaff);
      if (!isPremium) {
        throw new ForbiddenError('This problem requires a premium subscription');
      }
    }

    // Cheap, index-only viewer flags (solved list + bookmark list).
    let isSolved = false;
    let isBookmarked = false;
    if (viewer) {
      const [solvedIds, bookmarkIds] = await Promise.all([
        this.problems.recentlySolvedProblemIds(viewer.id, 500),
        this.bookmarks.listProblemIds(viewer.id),
      ]);
      isSolved = solvedIds.includes(problem.id);
      isBookmarked = bookmarkIds.includes(problem.id);
    }

    return toProblemDetailDto(problem, { isSolved, isBookmarked });
  }

  /**
   * Trending = most submitted in the last N days. Cached in Redis for
   * 5 minutes — the ranking is identical for every user, making this
   * the single highest-leverage cache in the module.
   */
  async trending(viewer?: AuthUser): Promise<ProblemSummaryDto[]> {
    const cached = await this.cache.getJson<ProblemSummaryDto[]>(CACHE.KEYS.trending);
    if (cached) {
      log.debug('trending served from cache');
      return this.applyViewerFlagsToCached(cached, viewer);
    }

    const trendingRows = await this.problems.trending(TRENDING.WINDOW_DAYS, TRENDING.SIZE);
    const rows = await this.problems.findManyByIds(trendingRows.map((t) => t.problemId));
    const visible = new Set(this.visibleVisibilities(undefined)); // cache guest-safe view only
    const dtos = rows
      .filter((r) => visible.has(r.visibility))
      .map((row) => toProblemSummaryDto(row, { solvedIds: new Set(), bookmarkedIds: new Set() }));

    await this.cache.setJson(CACHE.KEYS.trending, dtos, CACHE.TTL_TRENDING_SECONDS);
    return this.applyViewerFlagsToCached(dtos, viewer);
  }

  private async applyViewerFlagsToCached(
    dtos: ProblemSummaryDto[],
    viewer?: AuthUser,
  ): Promise<ProblemSummaryDto[]> {
    if (!viewer || dtos.length === 0) return dtos;
    const [solved, bookmarked] = await Promise.all([
      this.problems.recentlySolvedProblemIds(viewer.id, 500),
      this.bookmarks.listProblemIds(viewer.id),
    ]);
    const solvedSet = new Set(solved);
    const bookmarkedSet = new Set(bookmarked);
    return dtos.map((d) => ({
      ...d,
      isSolved: solvedSet.has(d.id),
      isBookmarked: bookmarkedSet.has(d.id),
    }));
  }

  async recentlySolved(viewer: AuthUser): Promise<ProblemSummaryDto[]> {
    const ids = await this.problems.recentlySolvedProblemIds(viewer.id, RECENTLY_SOLVED_SIZE);
    const rows = await this.problems.findManyByIds(ids);
    const bookmarkedIds = new Set(await this.bookmarks.listProblemIds(viewer.id));
    return rows.map((row) => toProblemSummaryDto(row, { solvedIds: new Set(ids), bookmarkedIds }));
  }
}
