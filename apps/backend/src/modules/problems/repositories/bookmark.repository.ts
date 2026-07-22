import type { PrismaClient } from '@prisma/client';
import type { IBookmarkRepository } from '../interfaces/problem.interfaces.js';

/**
 * Bookmark persistence. add() is an upsert so the endpoint is
 * idempotent — a double-tap on mobile can't 500 on the unique key.
 */
export class BookmarkRepository implements IBookmarkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(userId: string, problemId: string): Promise<void> {
    await this.prisma.bookmark.upsert({
      where: { userId_problemId: { userId, problemId } },
      create: { userId, problemId },
      update: {},
    });
  }

  async remove(userId: string, problemId: string): Promise<boolean> {
    const result = await this.prisma.bookmark.deleteMany({ where: { userId, problemId } });
    return result.count > 0;
  }

  async listProblemIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { problemId: true },
    });
    return rows.map((r) => r.problemId);
  }
}
