import { describe, expect, it } from 'vitest';
import { JudgeService } from '../../modules/judge/services/judge.service.js';
import { JUDGE_CONSTANTS } from '../../modules/judge/constants/judge.constants.js';
import type { SubmissionJob } from '../../modules/judge/types/judge.types.js';
import {
  FakeExecutionEngine,
  FakeProblemRepository,
  FakePublisher,
  FakeSubmissionRepository,
  FakeTimeline,
  outcome,
} from './judge-fakes.js';

/**
 * Performance characteristics that matter at 500k submissions/day:
 * bounded per-submission parallelism (so one submission can't starve the
 * engine) and correct handling of large test suites.
 */
describe('Judge performance', () => {
  function build(caseCount: number) {
    const execution = new FakeExecutionEngine();
    const problems = new FakeProblemRepository();
    problems.problem = {
      problemId: 'prob-1',
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      comparator: 'TOKEN',
      testCases: Array.from({ length: caseCount }, (_, i) => ({
        id: `tc${i}`,
        input: String(i),
        expectedOutput: String(i),
        isHidden: i > 0,
        weight: 1,
        order: i,
      })),
    };
    const service = new JudgeService(
      execution,
      problems,
      new FakeSubmissionRepository(),
      new FakePublisher(),
      new FakeTimeline(),
    );
    return { service, execution };
  }

  const job: SubmissionJob = {
    submissionId: 'sub-perf',
    userId: 'u1',
    problemId: 'prob-1',
    language: 'JAVASCRIPT',
    code: 'x',
    stopOnFirstFail: false,
    partialScoring: false,
  };

  it('judges a 100-test-case submission correctly', async () => {
    const { service, execution } = build(100);
    // Echo each input back so every case passes.
    for (let i = 0; i < 100; i += 1) {
      execution.responses.set(String(i), outcome({ stdout: String(i) }));
    }
    const result = await service.judge(job);
    expect(result.total).toBe(100);
    expect(result.passed).toBe(100);
    expect(result.verdict).toBe('ACCEPTED');
    expect(execution.calls).toHaveLength(100);
  });

  it('never exceeds the configured per-submission concurrency', async () => {
    const { service, execution } = build(20);
    let inFlight = 0;
    let maxInFlight = 0;
    const original = execution.run.bind(execution);
    execution.run = async (input) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return original(input);
    };
    await service.judge(job);
    expect(maxInFlight).toBeLessThanOrEqual(JUDGE_CONSTANTS.EXECUTION.TESTCASE_CONCURRENCY);
  });
});
