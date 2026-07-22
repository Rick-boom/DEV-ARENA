import { describe, expect, it } from 'vitest';
import { ResponseValidator } from '../../modules/ai-coach/validation/response-validator.js';
import { AiMode, type CoachContext } from '../../modules/ai-coach/types/ai.types.js';

const ctx: CoachContext = {
  problem: {
    problemId: 'p1',
    title: 'Two Sum',
    statement: 'Find two numbers that sum to target.',
    constraints: 'n<=1e4',
    difficulty: 'EASY',
    topics: ['arrays'],
    editorialText:
      'Use a hash map to store seen values and check the complement in one pass over the array quickly.',
    hiddenTestInputs: ['SECRET_HIDDEN_INPUT_42'],
  },
};

describe('ResponseValidator (anti-leak)', () => {
  const v = new ResponseValidator();

  it('parses valid structured JSON into a CoachResponse', () => {
    const raw = JSON.stringify({ summary: 'Think about complements.', points: ['Use a map.'] });
    const res = v.parseAndValidate(raw, AiMode.HINT, ctx);
    expect(res.summary).toContain('complements');
    expect(res.points).toHaveLength(1);
  });

  it('scrubs a response that echoes the withheld editorial', () => {
    const raw = JSON.stringify({
      summary:
        'Use a hash map to store seen values and check the complement in one pass over the array quickly.',
      points: [],
    });
    const res = v.parseAndValidate(raw, AiMode.HINT, ctx);
    expect(res.summary).not.toContain('one pass over the array quickly');
  });

  it('scrubs a response that leaks a hidden test input', () => {
    const raw = JSON.stringify({ summary: 'Try input SECRET_HIDDEN_INPUT_42', points: [] });
    const res = v.parseAndValidate(raw, AiMode.HINT, ctx);
    expect(res.summary).not.toContain('SECRET_HIDDEN_INPUT_42');
  });

  it('trims an oversized code block (no full solutions)', () => {
    const fence = '`'.repeat(3);
    const bigCode = `${fence}js\n${'const x=1;\n'.repeat(60)}${fence}`;
    const raw = JSON.stringify({ summary: 'Here', points: [bigCode] });
    const res = v.parseAndValidate(raw, AiMode.REVIEW, ctx);
    expect(res.points.join('')).toContain('code omitted');
  });

  it('handles non-JSON model output by wrapping it', () => {
    const res = v.parseAndValidate('just some prose the model returned', AiMode.HINT, ctx);
    expect(res.summary).toContain('prose');
  });

  it('coerces complexity-mode fields', () => {
    const raw = JSON.stringify({
      summary: 'O(n) scan',
      points: [],
      complexity: { time: 'O(n)', space: 'O(1)', explanation: 'single loop' },
    });
    const res = v.parseAndValidate(raw, AiMode.COMPLEXITY, ctx);
    expect(res.complexity?.time).toBe('O(n)');
  });
});
