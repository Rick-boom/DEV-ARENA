import { describe, expect, it } from 'vitest';
import { ScoringEngine } from '../../modules/judge/scoring/scoring-engine.js';
import type { TestCaseResult, Verdict } from '../../modules/judge/types/judge.types.js';

function caseResult(verdict: Verdict, weight = 1, skipped = false): TestCaseResult {
  const pass = verdict === 'ACCEPTED' || verdict === 'PRESENTATION_ERROR';
  return {
    testCaseId: `tc-${Math.random()}`,
    verdict,
    runtimeMs: 10,
    memoryKb: 1024,
    score: skipped ? 0 : pass ? weight : 0,
    maxScore: weight,
    skipped,
  };
}

describe('ScoringEngine', () => {
  const s = new ScoringEngine();
  const opts = { partialScoring: false, compileTimeMs: 0, executionTimeMs: 100 };

  it('is ACCEPTED only when every case passes', () => {
    const r = s.aggregate('sub1', [caseResult('ACCEPTED'), caseResult('ACCEPTED')], opts);
    expect(r.verdict).toBe('ACCEPTED');
    expect(r.passed).toBe(2);
    expect(r.percentage).toBe(100);
  });

  it('reports the FIRST failing verdict as the overall verdict', () => {
    const r = s.aggregate(
      'sub1',
      [caseResult('ACCEPTED'), caseResult('TIME_LIMIT_EXCEEDED'), caseResult('WRONG_ANSWER')],
      opts,
    );
    expect(r.verdict).toBe('TIME_LIMIT_EXCEEDED');
    expect(r.passed).toBe(1);
  });

  it('awards zero under all-or-nothing when any case fails', () => {
    const r = s.aggregate('sub1', [caseResult('ACCEPTED'), caseResult('WRONG_ANSWER')], opts);
    expect(r.totalScore).toBe(0);
  });

  it('awards weighted partial credit when partialScoring is on', () => {
    const r = s.aggregate('sub1', [caseResult('ACCEPTED', 3), caseResult('WRONG_ANSWER', 2)], {
      ...opts,
      partialScoring: true,
    });
    expect(r.totalScore).toBe(3);
    expect(r.maxScore).toBe(5);
    expect(r.percentage).toBe(60);
  });

  it('counts PRESENTATION_ERROR as a pass but surfaces it as the verdict', () => {
    const r = s.aggregate('sub1', [caseResult('ACCEPTED'), caseResult('PRESENTATION_ERROR')], opts);
    expect(r.passed).toBe(2);
    expect(r.verdict).toBe('PRESENTATION_ERROR');
  });

  it('does not blame a SKIPPED case for the overall verdict', () => {
    const r = s.aggregate(
      'sub1',
      [caseResult('WRONG_ANSWER'), caseResult('SKIPPED', 1, true)],
      opts,
    );
    expect(r.verdict).toBe('WRONG_ANSWER');
  });

  it('reports max runtime and peak memory across cases', () => {
    const a = caseResult('ACCEPTED');
    const b = { ...caseResult('ACCEPTED'), runtimeMs: 250, memoryKb: 9000 };
    const r = s.aggregate('sub1', [a, b], opts);
    expect(r.runtimeMs).toBe(250);
    expect(r.peakMemoryKb).toBe(9000);
  });

  it('scoreCase gives weight on pass, zero on fail or skip', () => {
    expect(s.scoreCase('ACCEPTED', 5, false)).toEqual({ score: 5, maxScore: 5 });
    expect(s.scoreCase('WRONG_ANSWER', 5, false)).toEqual({ score: 0, maxScore: 5 });
    expect(s.scoreCase('SKIPPED', 5, true)).toEqual({ score: 0, maxScore: 5 });
  });
});
