import type { PrismaClient } from '@prisma/client';
import type { SupportedLanguage } from '../constants/ai.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type {
  IProblemContextProvider,
  ISubmissionContextProvider,
} from '../interfaces/ai.interfaces.js';
import type { ProblemContext, SubmissionContext } from '../types/ai.types.js';

const log = createModuleLogger('ai-context-providers');

/**
 * Prisma-backed grounding adapters — the seam to the assumed Problem +
 * Submission/History services (here reading the shared DB directly).
 * These are the ONLY place the AI module touches Postgres, keeping the
 * grounding boundary clean and swappable (e.g. call the real services
 * over HTTP later without touching the coach logic).
 */
export class PrismaProblemContextProvider implements IProblemContextProvider {
  constructor(private readonly prisma: PrismaClient) {}

  async getProblem(problemId: string): Promise<ProblemContext | null> {
    const p = await this.prisma.problem.findUnique({
      where: { id: problemId },
      select: {
        id: true,
        title: true,
        statement: true,
        difficulty: true,
        constraints: { select: { description: true }, orderBy: { order: 'asc' } },
        editorial: { select: { content: true } },
        tags: { select: { tag: { select: { name: true } } } },
        testCases: { where: { isHidden: true }, select: { input: true } },
      },
    });
    if (!p) return null;
    return {
      problemId: p.id,
      title: p.title,
      statement: p.statement,
      constraints: p.constraints.map((c) => c.description).join('; '),
      difficulty: p.difficulty,
      topics: p.tags.map((t) => t.tag.name),
      // Attached for LEAK DETECTION only — never rendered into a prompt.
      editorialText: p.editorial?.content ?? undefined,
      hiddenTestInputs: p.testCases.map((t) => t.input),
    };
  }
}

export class PrismaSubmissionContextProvider implements ISubmissionContextProvider {
  constructor(private readonly prisma: PrismaClient) {}

  async getLatestSubmission(userId: string, problemId: string): Promise<SubmissionContext | null> {
    const s = await this.prisma.submission.findFirst({
      where: { userId, problemId },
      orderBy: { createdAt: 'desc' },
      select: { code: true, language: true, status: true, runtimeMs: true, memoryKb: true },
    });
    if (!s) return null;
    const recent = await this.prisma.submission.findMany({
      where: { userId, problemId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { status: true },
    });
    return {
      code: s.code,
      language: s.language.toLowerCase() as SupportedLanguage,
      verdict: s.status,
      runtimeMs: s.runtimeMs ?? undefined,
      memoryKb: s.memoryKb ?? undefined,
      recentVerdicts: recent.map((r) => r.status),
      attemptCount: recent.length,
    };
  }

  /** Weak topics = tags where the user has more non-accepted than accepted subs. */
  async getWeakTopics(userId: string): Promise<string[]> {
    try {
      const subs = await this.prisma.submission.findMany({
        where: { userId },
        select: {
          status: true,
          problem: { select: { tags: { select: { tag: { select: { name: true } } } } } },
        },
        take: 500,
        orderBy: { createdAt: 'desc' },
      });
      const score = new Map<string, number>(); // +1 fail, -1 pass
      for (const s of subs) {
        const delta = s.status === 'ACCEPTED' ? -1 : 1;
        for (const t of s.problem.tags) {
          score.set(t.tag.name, (score.get(t.tag.name) ?? 0) + delta);
        }
      }
      return [...score.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);
    } catch (err) {
      log.warn({ err }, 'weak topic derivation failed');
      return [];
    }
  }

  async getSolvedTopics(userId: string): Promise<string[]> {
    const solved = await this.prisma.submission.findMany({
      where: { userId, status: 'ACCEPTED' },
      select: { problem: { select: { tags: { select: { tag: { select: { name: true } } } } } } },
      take: 500,
    });
    return [...new Set(solved.flatMap((s) => s.problem.tags.map((t) => t.tag.name)))];
  }

  async suggestProblems(
    _userId: string,
    topics: string[],
    limit: number,
  ): Promise<{ problemId: string; title: string; topic: string }[]> {
    if (topics.length === 0) return [];
    const rows = await this.prisma.problem.findMany({
      where: { visibility: 'PUBLIC', tags: { some: { tag: { name: { in: topics } } } } },
      select: { id: true, title: true, tags: { select: { tag: { select: { name: true } } } } },
      take: limit,
    });
    return rows.map((r) => ({
      problemId: r.id,
      title: r.title,
      topic: r.tags.find((t) => topics.includes(t.tag.name))?.tag.name ?? topics[0]!,
    }));
  }
}
