import { createHash } from 'node:crypto';
import type { Language } from '@prisma/client';
import { JUDGE_CONSTANTS } from '../constants/judge.constants.js';
import {
  DuplicateSubmissionError,
  ProblemNotJudgeableError,
  RateLimitExceededError,
  SubmissionNotFoundError,
} from '../errors/judge-error.js';
import { createModuleLogger } from '../../../lib/logger.js';
import { JudgeEvent, type SubmissionJob } from '../types/judge.types.js';
import type {
  IDuplicateGuard,
  IEventPublisher,
  IJudgeQueue,
  IProblemRepository,
  IRateLimiter,
  ISubmissionRepository,
} from '../interfaces/judge.interfaces.js';

const log = createModuleLogger('submission-service');
const { KEYS, RATE_LIMIT, QUEUE } = JUDGE_CONSTANTS;

/**
 * The API-facing half of the judge. It admits a submission (rate-limit +
 * duplicate guard), persists it as PENDING, and enqueues it with the
 * right priority (battle/contest ahead of practice). Judging itself is
 * async in the worker — the client gets an id immediately and follows
 * the verdict via events / polling. This decoupling is what lets the
 * system absorb 500k submissions/day without blocking web requests.
 */
export class SubmissionService {
  constructor(
    private readonly submissions: ISubmissionRepository,
    private readonly problems: IProblemRepository,
    private readonly queue: IJudgeQueue,
    private readonly publisher: IEventPublisher,
    private readonly rateLimiter: IRateLimiter,
    private readonly duplicateGuard: IDuplicateGuard,
  ) {}

  async submit(input: {
    userId: string;
    problemId: string;
    battleId?: string;
    language: Language;
    code: string;
  }): Promise<{ submissionId: string }> {
    // 1. Rate limit per user.
    const allowed = await this.rateLimiter.hit(
      KEYS.rate(input.userId),
      RATE_LIMIT.WINDOW_MS,
      RATE_LIMIT.MAX_PER_MINUTE,
    );
    if (!allowed) throw new RateLimitExceededError();

    // 2. Problem must be judgeable.
    const problem = await this.problems.getJudgeProblem(input.problemId);
    if (!problem || problem.testCases.length === 0)
      throw new ProblemNotJudgeableError(input.problemId);

    // 3. Duplicate guard — reject an identical re-submit within the window.
    const codeHash = createHash('sha256').update(input.code).digest('hex').slice(0, 16);
    const fresh = await this.duplicateGuard.checkAndSet(
      input.userId,
      input.problemId,
      codeHash,
      RATE_LIMIT.DUPLICATE_WINDOW_MS,
    );
    if (!fresh) throw new DuplicateSubmissionError();

    // 4. Persist as PENDING (durable record before queueing).
    const { id } = await this.submissions.create(input);

    // 5. Enqueue with priority; a battle submission is judged ahead of practice.
    const job: SubmissionJob = {
      submissionId: id,
      userId: input.userId,
      problemId: input.problemId,
      battleId: input.battleId,
      language: input.language,
      code: input.code,
      stopOnFirstFail: input.battleId !== undefined, // contests stop early
      partialScoring: input.battleId !== undefined, // battles use partial credit
    };
    const priority = input.battleId ? QUEUE.PRIORITY.BATTLE : QUEUE.PRIORITY.PRACTICE;
    await this.submissions.markStatus(id, 'QUEUED');
    await this.queue.enqueue(job, priority);
    await this.publisher.publish(JudgeEvent.CREATED, {
      submissionId: id,
      userId: input.userId,
      problemId: input.problemId,
    });

    log.info({ submissionId: id, userId: input.userId, priority }, 'submission accepted');
    return { submissionId: id };
  }

  async getSubmission(submissionId: string) {
    const submission = await this.submissions.getSubmission(submissionId);
    if (!submission) throw new SubmissionNotFoundError(submissionId);
    return submission;
  }

  async history(userId: string, limit: number, offset: number) {
    return this.submissions.history(userId, limit, offset);
  }
}
