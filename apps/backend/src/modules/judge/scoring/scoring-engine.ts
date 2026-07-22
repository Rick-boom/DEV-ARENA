import type { JudgeResult, TestCaseResult, Verdict } from '../types/judge.types.js';

/**
 * Aggregates per-test-case results into a submission verdict + score.
 *
 * Two policies, both common in real judges:
 *  • ALL-OR-NOTHING (default): the submission is ACCEPTED only if every
 *    case passes; the overall verdict is the FIRST non-accepted case's
 *    verdict (what a user sees on Codeforces/LeetCode).
 *  • PARTIAL (weighted): score = sum of passed-case weights, so a
 *    submission that solves 8/10 cases still earns points (IOI-style,
 *    and useful for battle scoring).
 *
 * PRESENTATION_ERROR is treated as a pass for scoring but surfaced in
 * the verdict so the user can fix formatting.
 */
export class ScoringEngine {
  aggregate(
    submissionId: string,
    results: TestCaseResult[],
    opts: { partialScoring: boolean; compileTimeMs: number; executionTimeMs: number },
  ): JudgeResult {
    const total = results.length;
    const isPass = (v: Verdict): boolean => v === 'ACCEPTED' || v === 'PRESENTATION_ERROR';
    const passed = results.filter((r) => isPass(r.verdict)).length;

    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const maxScore = results.reduce((s, r) => s + r.maxScore, 0);

    // Overall verdict: ACCEPTED iff all passed; else the first failing
    // verdict (skipped cases don't count as the "cause").
    let overall: Verdict = 'ACCEPTED';
    const firstFail = results.find((r) => !isPass(r.verdict) && !r.skipped);
    if (firstFail) overall = firstFail.verdict;
    else if (results.some((r) => r.verdict === 'PRESENTATION_ERROR'))
      overall = 'PRESENTATION_ERROR';

    const runtimeMs = results.reduce((m, r) => Math.max(m, r.runtimeMs), 0);
    const peakMemoryKb = results.reduce((m, r) => Math.max(m, r.memoryKb), 0);

    return {
      submissionId,
      verdict: overall,
      totalScore: opts.partialScoring ? totalScore : overall === 'ACCEPTED' ? maxScore : 0,
      maxScore,
      percentage: maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100),
      passed,
      total,
      runtimeMs,
      peakMemoryKb,
      compileTimeMs: opts.compileTimeMs,
      executionTimeMs: opts.executionTimeMs,
      results,
    };
  }

  /** Score one case: full weight on pass, zero on fail (binary per case). */
  scoreCase(
    verdict: Verdict,
    weight: number,
    skipped: boolean,
  ): { score: number; maxScore: number } {
    const pass = verdict === 'ACCEPTED' || verdict === 'PRESENTATION_ERROR';
    return { score: skipped ? 0 : pass ? weight : 0, maxScore: weight };
  }
}
