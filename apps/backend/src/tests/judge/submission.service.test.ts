import { describe, expect, it, beforeEach } from 'vitest';
import { SubmissionService } from '../../modules/judge/services/submission.service.js';
import {
  DuplicateSubmissionError,
  ProblemNotJudgeableError,
  RateLimitExceededError,
  SubmissionNotFoundError,
} from '../../modules/judge/errors/judge-error.js';
import { JUDGE_CONSTANTS } from '../../modules/judge/constants/judge.constants.js';
import { JudgeEvent } from '../../modules/judge/types/judge.types.js';
import {
  FakeDuplicateGuard,
  FakeProblemRepository,
  FakePublisher,
  FakeQueue,
  FakeRateLimiter,
  FakeSubmissionRepository,
} from './judge-fakes.js';

function build() {
  const submissions = new FakeSubmissionRepository();
  const problems = new FakeProblemRepository();
  const queue = new FakeQueue();
  const publisher = new FakePublisher();
  const limiter = new FakeRateLimiter();
  const guard = new FakeDuplicateGuard();
  const service = new SubmissionService(submissions, problems, queue, publisher, limiter, guard);
  return { service, submissions, problems, queue, publisher, limiter, guard };
}

const input = {
  userId: 'u1',
  problemId: 'prob-1',
  language: 'JAVASCRIPT' as const,
  code: 'console.log(1)',
};

describe('SubmissionService', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('persists then queues a submission and returns its id', async () => {
    const { submissionId } = await ctx.service.submit(input);
    expect(submissionId).toBeTruthy();
    expect(ctx.submissions.created).toHaveLength(1);
    expect(ctx.queue.jobs).toHaveLength(1);
    expect(ctx.submissions.statuses).toContain('QUEUED');
  });

  it('publishes submission.created', async () => {
    await ctx.service.submit(input);
    expect(ctx.publisher.of(JudgeEvent.CREATED)).toHaveLength(1);
  });

  it('gives battle submissions higher queue priority than practice', async () => {
    await ctx.service.submit({ ...input, battleId: 'b1' });
    await ctx.service.submit({ ...input, code: 'different code' });
    const [battleJob, practiceJob] = ctx.queue.jobs;
    expect(battleJob!.priority).toBe(JUDGE_CONSTANTS.QUEUE.PRIORITY.BATTLE);
    expect(practiceJob!.priority).toBe(JUDGE_CONSTANTS.QUEUE.PRIORITY.PRACTICE);
    expect(battleJob!.priority).toBeLessThan(practiceJob!.priority); // lower = sooner
  });

  it('enables stop-on-first-fail and partial scoring for battle submissions', async () => {
    await ctx.service.submit({ ...input, battleId: 'b1' });
    expect(ctx.queue.jobs[0]!.job.stopOnFirstFail).toBe(true);
    expect(ctx.queue.jobs[0]!.job.partialScoring).toBe(true);
  });

  it('rejects an identical rapid re-submission', async () => {
    await ctx.service.submit(input);
    await expect(ctx.service.submit(input)).rejects.toBeInstanceOf(DuplicateSubmissionError);
  });

  it('allows a re-submission with different code', async () => {
    await ctx.service.submit(input);
    await expect(ctx.service.submit({ ...input, code: 'changed' })).resolves.toBeTruthy();
  });

  it('enforces the per-user rate limit', async () => {
    ctx.limiter.limit = 1;
    await ctx.service.submit(input);
    await expect(ctx.service.submit({ ...input, code: 'other' })).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
  });

  it('rejects a problem with no test cases', async () => {
    ctx.problems.problem = { ...ctx.problems.problem!, testCases: [] };
    await expect(ctx.service.submit(input)).rejects.toBeInstanceOf(ProblemNotJudgeableError);
  });

  it('does not queue when validation fails (queue protection)', async () => {
    ctx.problems.problem = null;
    await expect(ctx.service.submit(input)).rejects.toBeTruthy();
    expect(ctx.queue.jobs).toHaveLength(0);
  });

  it('throws SubmissionNotFound for an unknown id', async () => {
    ctx.submissions.getSubmission = async () => null;
    await expect(ctx.service.getSubmission('nope')).rejects.toBeInstanceOf(SubmissionNotFoundError);
  });
});
