import { JUDGE_CONSTANTS } from '../constants/judge.constants.js';
import { ExecutionUnavailableError, ProblemNotJudgeableError } from '../errors/judge-error.js';
import { createModuleLogger } from '../../../lib/logger.js';
import { VerdictMapper } from '../verdict/verdict-mapper.js';
import { ScoringEngine } from '../scoring/scoring-engine.js';
import {
  JudgeEvent,
  type JudgeProblem,
  type JudgeResult,
  type SubmissionJob,
  type TestCaseResult,
  type Verdict,
} from '../types/judge.types.js';
import type {
  IEventPublisher,
  IExecutionEngine,
  IProblemRepository,
  ISubmissionRepository,
  ITimeline,
} from '../interfaces/judge.interfaces.js';

const log = createModuleLogger('judge-service');
const { EXECUTION } = JUDGE_CONSTANTS;

/**
 * The judging core. Given a submission job it: resolves the problem's
 * test cases + limits, runs them through the Execution Engine with
 * BOUNDED parallelism, maps each run to a verdict, optionally stops on
 * the first failure (contest speed), scores the aggregate, persists
 * every result, and publishes lifecycle events (which the Battle Engine
 * consumes). Pure orchestration over injected ports — no I/O primitives
 * here, so it's fully unit-testable with fakes.
 */
export class JudgeService {
  constructor(
    private readonly execution: IExecutionEngine,
    private readonly problems: IProblemRepository,
    private readonly submissions: ISubmissionRepository,
    private readonly publisher: IEventPublisher,
    private readonly timeline: ITimeline,
    private readonly mapper = new VerdictMapper(),
    private readonly scorer = new ScoringEngine(),
  ) {}

  async judge(job: SubmissionJob): Promise<JudgeResult> {
    const startedAt = Date.now();
    await this.submissions.markStatus(job.submissionId, 'RUNNING');
    await this.timeline.record(job.submissionId, 'started');
    await this.publisher.publish(JudgeEvent.STARTED, { submissionId: job.submissionId });

    const problem = await this.problems.getJudgeProblem(job.problemId);
    if (!problem || problem.testCases.length === 0) {
      await this.submissions.markStatus(job.submissionId, 'INTERNAL_ERROR');
      throw new ProblemNotJudgeableError(job.problemId);
    }

    let results: TestCaseResult[];
    try {
      results = await this.runAllCases(job, problem);
    } catch (err) {
      // Distinguish an execution-infra outage (retryable) from a real
      // judgement — the former must NOT be recorded as the user's fault.
      await this.submissions.markStatus(job.submissionId, 'INTERNAL_ERROR');
      await this.publisher.publish(JudgeEvent.FAILED, {
        submissionId: job.submissionId,
        reason: (err as Error).message,
      });
      if (err instanceof ExecutionUnavailableError) throw err;
      throw err;
    }

    const result = this.scorer.aggregate(job.submissionId, results, {
      partialScoring: job.partialScoring,
      compileTimeMs: 0,
      executionTimeMs: Date.now() - startedAt,
    });

    await this.submissions.finalize(result);
    await this.timeline.record(job.submissionId, 'completed', {
      verdict: result.verdict,
      score: result.totalScore,
    });
    await this.publisher.publish(JudgeEvent.COMPLETED, {
      submissionId: job.submissionId,
      verdict: result.verdict,
      passed: result.passed,
      total: result.total,
    });
    // Verdict event is what the Battle Engine listens for (battleId present).
    await this.publisher.publish(JudgeEvent.VERDICT, {
      submissionId: job.submissionId,
      userId: job.userId,
      problemId: job.problemId,
      battleId: job.battleId ?? null,
      verdict: result.verdict,
      passed: result.passed,
      total: result.total,
      score: result.totalScore,
      maxScore: result.maxScore,
      runtimeMs: result.runtimeMs,
    });
    log.info(
      {
        submissionId: job.submissionId,
        verdict: result.verdict,
        passed: result.passed,
        total: result.total,
      },
      'submission judged',
    );
    return result;
  }

  /**
   * Runs the problem's test cases. Public/sample cases first (fast user
   * feedback), then hidden. Bounded parallelism keeps one submission
   * from saturating the engine. Under stopOnFirstFail, once a case fails
   * the remaining cases are marked SKIPPED without running (contest
   * speed + engine savings).
   */
  private async runAllCases(job: SubmissionJob, problem: JudgeProblem): Promise<TestCaseResult[]> {
    const ordered = [...problem.testCases].sort((a, b) => {
      if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1; // public first
      return a.order - b.order;
    });

    const results: TestCaseResult[] = [];
    let failedEarly = false;

    for (let i = 0; i < ordered.length; i += EXECUTION.TESTCASE_CONCURRENCY) {
      if (failedEarly && job.stopOnFirstFail) {
        for (const tc of ordered.slice(i)) results.push(this.skippedResult(tc.id, tc.weight));
        break;
      }
      const batch = ordered.slice(i, i + EXECUTION.TESTCASE_CONCURRENCY);
      const batchResults = await Promise.all(batch.map((tc) => this.runOne(job, problem, tc)));
      results.push(...batchResults);
      await this.publisher.publish(JudgeEvent.RUNNING, {
        submissionId: job.submissionId,
        completed: results.length,
        total: ordered.length,
      });
      if (
        batchResults.some((r) => r.verdict !== 'ACCEPTED' && r.verdict !== 'PRESENTATION_ERROR')
      ) {
        failedEarly = true;
      }
    }
    return results;
  }

  private async runOne(
    job: SubmissionJob,
    problem: JudgeProblem,
    tc: JudgeProblem['testCases'][number],
  ): Promise<TestCaseResult> {
    let outcome;
    try {
      outcome = await this.execution.run({
        language: job.language,
        code: job.code,
        stdin: tc.input,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
      });
    } catch (err) {
      log.error(
        { err, submissionId: job.submissionId, testCaseId: tc.id },
        'execution engine call failed',
      );
      throw new ExecutionUnavailableError();
    }

    // Enforce our own output ceiling even if the engine didn't flag it.
    if (!outcome.truncated && this.mapper.exceedsOutputLimit(outcome.stdout)) {
      outcome = { ...outcome, truncated: true };
    }

    const verdict: Verdict = this.mapper.map(outcome, tc, problem.comparator);
    const { score, maxScore } = this.scorer.scoreCase(verdict, tc.weight, false);
    const result: TestCaseResult = {
      testCaseId: tc.id,
      verdict,
      runtimeMs: Math.round(outcome.durationMs),
      memoryKb: Math.round(outcome.memoryUsedMb * 1024),
      // Never surface expected output; only the user's own stderr, trimmed.
      stderr: outcome.stderr ? outcome.stderr.slice(0, 2000) : undefined,
      score,
      maxScore,
      skipped: false,
    };
    await this.submissions.saveResult(job.submissionId, result);
    return result;
  }

  private skippedResult(testCaseId: string, weight: number): TestCaseResult {
    return {
      testCaseId,
      verdict: 'SKIPPED',
      runtimeMs: 0,
      memoryKb: 0,
      score: 0,
      maxScore: weight,
      skipped: true,
    };
  }
}
