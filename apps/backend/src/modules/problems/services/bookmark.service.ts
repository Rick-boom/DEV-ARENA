import type { Paginated } from '@devarena/shared-types';
import { ProblemNotFoundError } from '../../../errors/app-error.js';
import type { IBookmarkRepository, IProblemRepository } from '../interfaces/problem.interfaces.js';
import { toProblemSummaryDto, type ProblemSummaryDto } from '../dto/problem-response.dto.js';
import type { AuthUser } from '../../../middlewares/auth.middleware.js';

/**
 * Bookmark use cases. Verifies the problem exists (and is visible —
 * findByIdOrSlug already excludes soft-deleted rows) before writing,
 * so users can't bookmark ghosts.
 */
export class BookmarkService {
  constructor(
    private readonly bookmarks: IBookmarkRepository,
    private readonly problems: IProblemRepository,
  ) {}

  async add(idOrSlug: string, viewer: AuthUser): Promise<void> {
    const problem = await this.problems.findByIdOrSlug(idOrSlug);
    if (!problem) throw new ProblemNotFoundError(idOrSlug);
    await this.bookmarks.add(viewer.id, problem.id);
  }

  async remove(idOrSlug: string, viewer: AuthUser): Promise<boolean> {
    const problem = await this.problems.findByIdOrSlug(idOrSlug);
    if (!problem) throw new ProblemNotFoundError(idOrSlug);
    return this.bookmarks.remove(viewer.id, problem.id);
  }

  async listMine(
    viewer: AuthUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<ProblemSummaryDto>> {
    const allIds = await this.bookmarks.listProblemIds(viewer.id);
    const pageIds = allIds.slice((page - 1) * pageSize, page * pageSize);
    const rows = await this.problems.findManyByIds(pageIds);
    const bookmarkedIds = new Set(allIds);
    const solvedIds = new Set(await this.problems.recentlySolvedProblemIds(viewer.id, 500));
    return {
      items: rows.map((row) => toProblemSummaryDto(row, { solvedIds, bookmarkedIds })),
      page,
      pageSize,
      total: allIds.length,
    };
  }
}
