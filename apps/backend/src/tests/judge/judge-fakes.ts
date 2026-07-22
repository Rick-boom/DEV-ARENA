import type { Language } from '@prisma/client';
import type {
  IDuplicateGuard,
  IEventPublisher,
  IExecutionEngine,
  IJudgeQueue,
  IProblemRepository,
  IRateLimiter,
  ISubmissionRepository,
  ITimeline,
} from '../../modules/judge/interfaces/judge.interfaces.js';
import {
  ComparatorKind,
  type ExecutionOutcome,
  type JudgeEvent,
  type JudgeProblem,
  type JudgeResult,
  type SubmissionJob,
  type TestCaseResult,
  type Verdict,
} from '../../modules/judge/types/judge.types.js';

/** Fakes so the whole judge runs with no Docker, Postgres, Redis, or BullMQ. */

export function outcome(over: Partial<ExecutionOutcome> = {}): ExecutionOutcome {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    durationMs: 10,
    memoryUsedMb: 1,
    oomKilled: false,
    timedOut: false,
    truncated: false,
    ...over,
  };
}

export class FakeExecutionEngine implements IExecutionEngine {
  calls: { stdin: string }[] = [];
  /** stdin → outcome; falls back to `default` */
  responses = new Map<string, ExecutionOutcome>();
  default: ExecutionOutcome = outcome();
  shouldThrow: Error | null = null;

  async run(input: { language: Language; code: string; stdin: string }): Promise<ExecutionOutcome> {
    this.calls.push({ stdin: input.stdin });
    if (this.shouldThrow) throw this.shouldThrow;
    return this.responses.get(input.stdin) ?? this.default;
  }
}

export class FakeProblemRepository implements IProblemRepository {
  problem: JudgeProblem | null = {
    problemId: 'prob-1',
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    comparator: ComparatorKind.TOKEN,
    testCases: [
      { id: 'tc1', input: '1', expectedOutput: '1', isHidden: false, weight: 1, order: 0 },
      { id: 'tc2', input: '2', expectedOutput: '2', isHidden: true, weight: 1, order: 1 },
      { id: 'tc3', input: '3', expectedOutput: '3', isHidden: true, weight: 1, order: 2 },
    ],
  };
  async getJudgeProblem(): Promise<JudgeProblem | null> {
    return this.problem;
  }
}

export class FakeSubmissionRepository implements ISubmissionRepository {
  statuses: Verdict[] = [];
  results: TestCaseResult[] = [];
  finalized: JudgeResult | null = null;
  created: { id: string }[] = [];
  submission: Awaited<ReturnType<ISubmissionRepository['getSubmission']>> = {
    id: 'sub-1',
    userId: 'u1',
    problemId: 'prob-1',
    battleId: null,
    language: 'JAVASCRIPT' as Language,
    code: 'code',
    status: 'PENDING',
  };

  async markStatus(_id: string, status: Verdict): Promise<void> {
    this.statuses.push(status);
  }
  async saveResult(_id: string, result: TestCaseResult): Promise<void> {
    this.results.push(result);
  }
  async finalize(result: JudgeResult): Promise<void> {
    this.finalized = result;
  }
  async getSubmission() {
    return this.submission;
  }
  async history() {
    return [];
  }
  async create(): Promise<{ id: string }> {
    const row = { id: `sub-${this.created.length + 1}` };
    this.created.push(row);
    return row;
  }
}

export class FakeQueue implements IJudgeQueue {
  jobs: { job: SubmissionJob; priority: number }[] = [];
  shouldThrow: Error | null = null;
  async enqueue(job: SubmissionJob, priority: number): Promise<void> {
    if (this.shouldThrow) throw this.shouldThrow;
    this.jobs.push({ job, priority });
  }
}

export class FakePublisher implements IEventPublisher {
  events: { event: JudgeEvent; payload: Record<string, unknown> }[] = [];
  async publish(event: JudgeEvent, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ event, payload });
  }
  of(event: JudgeEvent) {
    return this.events.filter((e) => e.event === event);
  }
}

export class FakeTimeline implements ITimeline {
  entries: { submissionId: string; stage: string }[] = [];
  async record(submissionId: string, stage: string): Promise<void> {
    this.entries.push({ submissionId, stage });
  }
}

export class FakeRateLimiter implements IRateLimiter {
  counts = new Map<string, number>();
  limit = 1000;
  async hit(key: string): Promise<boolean> {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n <= this.limit;
  }
}

export class FakeDuplicateGuard implements IDuplicateGuard {
  seen = new Set<string>();
  async checkAndSet(userId: string, problemId: string, codeHash: string): Promise<boolean> {
    const key = `${userId}:${problemId}:${codeHash}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}
