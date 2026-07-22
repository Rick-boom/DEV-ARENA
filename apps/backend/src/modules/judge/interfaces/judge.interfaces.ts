import type { Language } from '@prisma/client';
import type {
  ExecutionOutcome,
  JudgeEvent,
  JudgeProblem,
  JudgeResult,
  SubmissionJob,
  TestCaseResult,
  Verdict,
} from '../types/judge.types.js';

/**
 * Ports. The judge service depends only on these abstractions — never on
 * fetch/Prisma/ioredis/BullMQ directly — so the Execution Engine is
 * swappable, the whole pipeline is testable with fakes (essential: we
 * can't run Docker in CI), and persistence stays behind one boundary.
 */

/** The (assumed) Execution Engine: compile+run one input, get an outcome. */
export interface IExecutionEngine {
  /** Run the code against a single test-case input. */
  run(input: {
    language: Language;
    code: string;
    stdin: string;
    timeLimitMs: number;
    memoryLimitMb: number;
  }): Promise<ExecutionOutcome>;
}

/** Reads/writes submissions + their per-case results (Postgres). */
export interface ISubmissionRepository {
  markStatus(submissionId: string, status: Verdict): Promise<void>;
  saveResult(submissionId: string, result: TestCaseResult): Promise<void>;
  finalize(result: JudgeResult): Promise<void>;
  getSubmission(submissionId: string): Promise<{
    id: string;
    userId: string;
    problemId: string;
    battleId: string | null;
    language: Language;
    code: string;
    status: Verdict;
  } | null>;
  history(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<
    { id: string; problemId: string; status: Verdict; runtimeMs: number | null; createdAt: Date }[]
  >;
  create(input: {
    userId: string;
    problemId: string;
    battleId?: string;
    language: Language;
    code: string;
  }): Promise<{ id: string }>;
}

/** Resolves the judging config (limits + comparator + test cases). */
export interface IProblemRepository {
  getJudgeProblem(problemId: string): Promise<JudgeProblem | null>;
}

/** The submission queue (BullMQ) — enqueue with priority. */
export interface IJudgeQueue {
  enqueue(job: SubmissionJob, priority: number): Promise<void>;
}

/** Publishes lifecycle events to battle/socket/etc. */
export interface IEventPublisher {
  publish(event: JudgeEvent, payload: Record<string, unknown>): Promise<void>;
}

export interface IRateLimiter {
  hit(key: string, windowMs: number, max: number): Promise<boolean>;
}

/** Duplicate-submission guard (identical code within a short window). */
export interface IDuplicateGuard {
  checkAndSet(
    userId: string,
    problemId: string,
    codeHash: string,
    windowMs: number,
  ): Promise<boolean>;
}

/** Append-only judging timeline (Redis) for observability/debugging. */
export interface ITimeline {
  record(submissionId: string, stage: string, detail?: Record<string, unknown>): Promise<void>;
}
