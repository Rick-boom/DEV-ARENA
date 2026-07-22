import { describe, expect, it } from 'vitest';
import { OutputComparator } from '../../modules/judge/comparators/output-comparator.js';
import { VerdictMapper } from '../../modules/judge/verdict/verdict-mapper.js';
import { ComparatorKind, type JudgeTestCase } from '../../modules/judge/types/judge.types.js';
import { outcome } from './judge-fakes.js';

const tc: JudgeTestCase = {
  id: 't',
  input: '',
  expectedOutput: '42',
  isHidden: false,
  weight: 1,
  order: 0,
};

describe('OutputComparator', () => {
  const c = new OutputComparator();

  describe('token (default)', () => {
    it('matches identical output', () => {
      expect(c.compare(ComparatorKind.TOKEN, '1 2 3', '1 2 3').match).toBe(true);
    });
    it('ignores trailing newline/whitespace', () => {
      const r = c.compare(ComparatorKind.TOKEN, '1 2 3', '1 2 3\n');
      expect(r.match).toBe(true);
      expect(r.presentationError).toBe(false);
    });
    it('flags a presentation error when tokens match but layout differs', () => {
      const r = c.compare(ComparatorKind.TOKEN, '1 2 3', '1\n2\n3');
      expect(r.match).toBe(true);
      expect(r.presentationError).toBe(true);
    });
    it('rejects different tokens', () => {
      expect(c.compare(ComparatorKind.TOKEN, '1 2 3', '1 2 4').match).toBe(false);
    });
    it('rejects a different token count', () => {
      expect(c.compare(ComparatorKind.TOKEN, '1 2', '1 2 3').match).toBe(false);
    });
  });

  describe('exact', () => {
    it('is byte-for-byte (whitespace matters)', () => {
      expect(c.compare(ComparatorKind.EXACT, '1 2 3', '1\n2\n3').match).toBe(false);
      expect(c.compare(ComparatorKind.EXACT, 'abc', 'abc\n').match).toBe(true); // one trailing NL ok
    });
  });

  describe('float', () => {
    it('accepts values within epsilon', () => {
      expect(c.compare(ComparatorKind.FLOAT, '0.3', '0.30000000004').match).toBe(true);
    });
    it('rejects values outside epsilon', () => {
      expect(c.compare(ComparatorKind.FLOAT, '0.3', '0.4').match).toBe(false);
    });
    it('compares non-numeric tokens exactly', () => {
      expect(c.compare(ComparatorKind.FLOAT, 'YES 1.0', 'YES 1.0000001').match).toBe(true);
      expect(c.compare(ComparatorKind.FLOAT, 'YES 1.0', 'NO 1.0').match).toBe(false);
    });
  });
});

describe('VerdictMapper precedence', () => {
  const m = new VerdictMapper();
  const K = ComparatorKind.TOKEN;

  it('returns ACCEPTED on a correct run', () => {
    expect(m.map(outcome({ stdout: '42' }), tc, K)).toBe('ACCEPTED');
  });
  it('returns WRONG_ANSWER on incorrect output', () => {
    expect(m.map(outcome({ stdout: '41' }), tc, K)).toBe('WRONG_ANSWER');
  });
  it('returns PRESENTATION_ERROR when only layout differs', () => {
    const multi: JudgeTestCase = { ...tc, expectedOutput: '1 2' };
    expect(m.map(outcome({ stdout: '1\n2' }), multi, K)).toBe('PRESENTATION_ERROR');
  });
  it('prefers TLE over output comparison', () => {
    // Correct output but timed out → must be TLE, never ACCEPTED.
    expect(m.map(outcome({ stdout: '42', timedOut: true }), tc, K)).toBe('TIME_LIMIT_EXCEEDED');
  });
  it('prefers MLE over output comparison', () => {
    expect(m.map(outcome({ stdout: '42', oomKilled: true }), tc, K)).toBe('MEMORY_LIMIT_EXCEEDED');
  });
  it('returns OUTPUT_LIMIT_EXCEEDED when truncated', () => {
    expect(m.map(outcome({ stdout: '42', truncated: true }), tc, K)).toBe('OUTPUT_LIMIT_EXCEEDED');
  });
  it('returns RUNTIME_ERROR on a non-zero exit', () => {
    expect(m.map(outcome({ stdout: '42', exitCode: 1 }), tc, K)).toBe('RUNTIME_ERROR');
  });
  it('returns RUNTIME_ERROR on a null exit (signal)', () => {
    expect(m.map(outcome({ stdout: '42', exitCode: null }), tc, K)).toBe('RUNTIME_ERROR');
  });
  it('returns COMPILATION_ERROR above everything else', () => {
    expect(m.map(outcome({ compileError: 'syntax error', timedOut: true }), tc, K)).toBe(
      'COMPILATION_ERROR',
    );
  });
  it('detects an oversized stdout', () => {
    expect(m.exceedsOutputLimit('x'.repeat(300_000))).toBe(true);
    expect(m.exceedsOutputLimit('small')).toBe(false);
  });
});
