import { describe, expect, it, beforeEach } from 'vitest';
import { Role } from '@prisma/client';
import { BookmarkService } from '../../modules/problems/services/bookmark.service.js';
import { ProblemNotFoundError } from '../../errors/app-error.js';
import { FakeBookmarkRepository, FakeProblemRepository, makeProblem } from '../fakes/fakes.js';

const viewer = { id: 'u1', role: Role.USER };

describe('BookmarkService', () => {
  let problems: FakeProblemRepository;
  let bookmarks: FakeBookmarkRepository;
  let service: BookmarkService;

  beforeEach(() => {
    problems = new FakeProblemRepository();
    bookmarks = new FakeBookmarkRepository();
    service = new BookmarkService(bookmarks, problems);
  });

  it('adds a bookmark by slug (idempotent)', async () => {
    const p = makeProblem();
    problems.problems.push(p);
    await service.add('two-sum', viewer);
    await service.add('two-sum', viewer); // second call is a no-op, not an error
    expect(await bookmarks.listProblemIds('u1')).toEqual([p.id]);
  });

  it('404s when bookmarking a missing or soft-deleted problem', async () => {
    await expect(service.add('ghost', viewer)).rejects.toBeInstanceOf(ProblemNotFoundError);
    const p = makeProblem({ deletedAt: new Date() });
    problems.problems.push(p);
    await expect(service.add(p.id, viewer)).rejects.toBeInstanceOf(ProblemNotFoundError);
  });

  it('removes a bookmark', async () => {
    const p = makeProblem();
    problems.problems.push(p);
    await service.add(p.id, viewer);
    const removed = await service.remove(p.id, viewer);
    expect(removed).toBe(true);
    expect(await bookmarks.listProblemIds('u1')).toEqual([]);
  });

  it('lists my bookmarks paginated with flags', async () => {
    const p = makeProblem();
    problems.problems.push(p);
    await service.add(p.id, viewer);
    problems.solvedByUser.set('u1', [p.id]);
    const page = await service.listMine(viewer, 1, 10);
    expect(page.total).toBe(1);
    expect(page.items[0]?.isBookmarked).toBe(true);
    expect(page.items[0]?.isSolved).toBe(true);
  });
});
