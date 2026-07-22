import { describe, expect, it, beforeEach } from 'vitest';
import { JudgeService } from '../../modules/judge/services/judge.service.js';
import {
  ExecutionUnavailableError,
  ProblemNotJudgeableError,
} from '../../modules/judge/errors/judge-error.js';
import { JudgeEvent, type SubmissionJob } from '../../modules/judge/types/judge.types.js';
import {
  FakeExecutionEngine,
  FakeProblemRepository,
  FakePublisher,
  FakeSubmissionRepository,
  FakeTimeline,
  outcome,
} from './judge-fakes.js';

function build() {
  const execution = new FakeExecutionEngine();
  const problems = new FakeProblemRepository();
  const submissions = new FakeSubmissionRepository();
  const publisher = new FakePublisher();
  const timeline = new FakeTimeline();
  const service = new JudgeService(execution, problems, submissions, publisher, timeline);
  return { service, execution, problems, submissions, publisher, timeline };
}

const job: SubmissionJob = {
  submissionId: 'sub-1',
  userId: 'u1',
  problemId: 'prob-1',
  language: 'JAVASCRIPT',
  code: 'console.log(1)',
  stopOnFirstFail: false,
  partialScoring: false,
};

describe('JudgeService', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('returns ACCEPTED when every test case passes', async () => {
    // Echo the input back → matches expectedOutput for all three cases.
    ctx.execution.responses.set('1', outcome({ stdout: '1' }));
    ctx.execution.responses.set('2', outcome({ stdout: '2' }));
    ctx.execution.responses.set('3', outcome({ stdout: '3' }));

    const result = await ctx.service.judge(job);
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.passed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it('returns WRONG_ANSWER and identifies the failing case', async () => {
    ctx.execution.responses.set('1', outcome({ stdout: '1' }));
    ctx.execution.responses.set('2', outcome({ stdout: 'WRONG' }));
    ctx.execution.responses.set('3', outcome({ stdout: '3' }));

    const result = await ctx.service.judge(job);
    expect(result.verdict).toBe('WRONG_ANSWER');
    expect(result.passed).toBe(2);
  });

  it('maps TLE/MLE/RE from the execution outcome', async () => {
    ctx.execution.default = outcome({ timedOut: true });
    expect((await ctx.service.judge(job)).verdict).toBe('TIME_LIMIT_EXCEEDED');

    const ctx2 = build();
    ctx2.execution.default = outcome({ oomKilled: true });
    expect((await ctx2.service.judge(job)).verdict).toBe('MEMORY_LIMIT_EXCEEDED');

    const ctx3 = build();
    ctx3.execution.default = outcome({ exitCode: 139 });
    expect((await ctx3.service.judge(job)).verdict).toBe('RUNTIME_ERROR');
  });

  it('runs public test cases before hidden ones', async () => {
    ctx.execution.default = outcome({ stdout: 'x' });
    await ctx.service.judge(job);
    // tc1 is the only public case and must be executed first.
    expect(ctx.execution.calls[0]!.stdin).toBe('1');
  });

  it('skips remaining cases under stopOnFirstFail', async () => {
    // Force a small concurrency effect: first batch fails, rest skipped.
    ctx.problems.problem = {
      ...ctx.problems.problem!,
      testCases: Array.from({ length: 10 }, (_, i) => ({
        id: `tc${i}`,
        input: String(i),
        expectedOutput: String(i),
        isHidden: false,
        weight: 1,
        order: i,
      })),
    };
    ctx.execution.default = outcome({ stdout: 'WRONG' }); // every case fails

    const result = await ctx.service.judge({ ...job, stopOnFirstFail: true });
    const skipped = result.results.filter((r) => r.skipped);
    expect(skipped.length).toBeGreaterThan(0);
    // The engine was NOT called for every case (work was saved).
    expect(ctx.execution.calls.length).toBeLessThan(10);
  });

  it('awards partial credit when partialScoring is enabled', async () => {
    ctx.execution.responses.set('1', outcome({ stdout: '1' }));
    ctx.execution.responses.set('2', outcome({ stdout: '2' }));
    ctx.execution.responses.set('3', outcome({ stdout: 'WRONG' }));

    const result = await ctx.service.judge({ ...job, partialScoring: true });
    expect(result.totalScore).toBe(2);
    expect(result.maxScore).toBe(3);
  });

  it('persists every per-case result and finalizes the submission', async () => {
    ctx.execution.default = outcome({ stdout: 'x' });
    await ctx.service.judge(job);
    expect(ctx.submissions.results).toHaveLength(3);
    expect(ctx.submissions.finalized).not.toBeNull();
    expect(ctx.submissions.statuses).toContain('RUNNING');
  });

  it('publishes the full event lifecycle including the verdict', async () => {
    ctx.execution.default = outcome({ stdout: 'x' });
    await ctx.service.judge(job);
    expect(ctx.publisher.of(JudgeEvent.STARTED)).toHaveLength(1);
    expect(ctx.publisher.of(JudgeEvent.RUNNING).length).toBeGreaterThan(0);
    expect(ctx.publisher.of(JudgeEvent.COMPLETED)).toHaveLength(1);
    const verdictEvents = ctx.publisher.of(JudgeEvent.VERDICT);
    expect(verdictEvents).toHaveLength(1);
    expect(verdictEvents[0]!.payload).toHaveProperty('passed');
    expect(verdictEvents[0]!.payload).toHaveProperty('total');
  });

  it('records a judging timeline', async () => {
    ctx.execution.default = outcome({ stdout: 'x' });
    await ctx.service.judge(job);
    const stages = ctx.timeline.entries.map((e) => e.stage);
    expect(stages).toContain('started');
    expect(stages).toContain('completed');
  });
});

describe('JudgeService failure recovery', () => {
  it('throws ProblemNotJudgeable when the problem has no test cases', async () => {
    const ctx = build();
    ctx.problems.problem = { ...ctx.problems.problem!, testCases: [] };
    await expect(ctx.service.judge(job)).rejects.toBeInstanceOf(ProblemNotJudgeableError);
    expect(ctx.submissions.statuses).toContain('INTERNAL_ERROR');
  });

  it('surfaces ExecutionUnavailable when the engine is down (retryable)', async () => {
    const ctx = build();
    ctx.execution.shouldThrow = new Error('ECONNREFUSED');
    await expect(ctx.service.judge(job)).rejects.toBeInstanceOf(ExecutionUnavailableError);
    // Marked INTERNAL_ERROR, never blamed on the user's code.
    expect(ctx.submissions.statuses).toContain('INTERNAL_ERROR');
  });

  it('publishes submission.failed on an infra failure', async () => {
    const ctx = build();
    ctx.execution.shouldThrow = new Error('boom');
    await expect(ctx.service.judge(job)).rejects.toBeTruthy();
    expect(ctx.publisher.of(JudgeEvent.FAILED)).toHaveLength(1);
  });
});
