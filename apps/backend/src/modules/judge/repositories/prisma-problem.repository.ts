import type { PrismaClient } from '@prisma/client';
import { ComparatorKind, type JudgeProblem } from '../types/judge.types.js';
import type { IProblemRepository } from '../interfaces/judge.interfaces.js';

/**
 * Resolves the judging config for a problem: resource limits + all test
 * cases (public AND hidden). The comparator isn't a schema column, so we
 * DERIVE it: problems whose expected outputs look numeric use FLOAT
 * tolerance, everything else uses whitespace-normalized TOKEN compare.
 * This keeps zero schema changes while still supporting float problems
 * correctly; a future `comparator` column can override it here alone.
 */
export class PrismaProblemRepository implements IProblemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getJudgeProblem(problemId: string): Promise<JudgeProblem | null> {
    const p = await this.prisma.problem.findUnique({
      where: { id: problemId },
      select: {
        id: true,
        timeLimitMs: true,
        memoryLimitMb: true,
        testCases: {
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            isHidden: true,
            weight: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!p) return null;
    return {
      problemId: p.id,
      timeLimitMs: p.timeLimitMs,
      memoryLimitMb: p.memoryLimitMb,
      comparator: this.deriveComparator(p.testCases.map((t) => t.expectedOutput)),
      testCases: p.testCases,
    };
  }

  /** Float compare when every expected output token parses as a non-integer number. */
  private deriveComparator(expectedOutputs: string[]): ComparatorKind {
    if (expectedOutputs.length === 0) return ComparatorKind.TOKEN;
    const hasDecimal = expectedOutputs.some((out) =>
      out
        .trim()
        .split(/\s+/)
        .some((tok) => /^-?\d+\.\d+$/.test(tok)),
    );
    return hasDecimal ? ComparatorKind.FLOAT : ComparatorKind.TOKEN;
  }
}
