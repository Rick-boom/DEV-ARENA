import type { Language, PrismaClient } from '@prisma/client';
import { createModuleLogger } from '../../../lib/logger.js';
import type { ISubmissionRepository } from '../interfaces/judge.interfaces.js';
import type { JudgeResult, TestCaseResult, Verdict } from '../types/judge.types.js';

const log = createModuleLogger('prisma-submission-repo');

/**
 * Durable submission persistence over Prisma. Writes the submission row,
 * every per-test-case SubmissionResult, and the finalized verdict +
 * runtime/memory. Uses upsert on results so a retried judge run is
 * idempotent (the @@unique([submissionId, testCaseId]) makes this safe).
 */
export class PrismaSubmissionRepository implements ISubmissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    userId: string;
    problemId: string;
    battleId?: string;
    language: Language;
    code: string;
  }): Promise<{ id: string }> {
    const row = await this.prisma.submission.create({
      data: {
        userId: input.userId,
        problemId: input.problemId,
        battleId: input.battleId ?? null,
        language: input.language,
        code: input.code,
        status: 'PENDING',
      },
      select: { id: true },
    });
    return row;
  }

  async markStatus(submissionId: string, status: Verdict): Promise<void> {
    await this.prisma.submission.update({ where: { id: submissionId }, data: { status } });
  }

  async saveResult(submissionId: string, result: TestCaseResult): Promise<void> {
    await this.prisma.submissionResult.upsert({
      where: { submissionId_testCaseId: { submissionId, testCaseId: result.testCaseId } },
      create: {
        submissionId,
        testCaseId: result.testCaseId,
        status: result.verdict,
        runtimeMs: result.runtimeMs,
        memoryKb: result.memoryKb,
        stderr: result.stderr ?? null,
      },
      update: {
        status: result.verdict,
        runtimeMs: result.runtimeMs,
        memoryKb: result.memoryKb,
        stderr: result.stderr ?? null,
      },
    });
  }

  async finalize(result: JudgeResult): Promise<void> {
    await this.prisma.submission.update({
      where: { id: result.submissionId },
      data: { status: result.verdict, runtimeMs: result.runtimeMs, memoryKb: result.peakMemoryKb },
    });
    log.debug(
      { submissionId: result.submissionId, verdict: result.verdict },
      'submission finalized',
    );
  }

  async getSubmission(submissionId: string) {
    const s = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        userId: true,
        problemId: true,
        battleId: true,
        language: true,
        code: true,
        status: true,
      },
    });
    return s;
  }

  async history(userId: string, limit: number, offset: number) {
    return this.prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: { id: true, problemId: true, status: true, runtimeMs: true, createdAt: true },
    });
  }
}
