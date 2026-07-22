import { describe, expect, it } from 'vitest';
import {
  computePair,
  expectedScore,
  kFactor,
  nextRating,
} from '../../modules/matchmaking/elo/elo.js';
import { MatchOutcome } from '../../modules/matchmaking/types/matchmaking.types.js';

describe('Elo', () => {
  it('gives ~0.5 expected score for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });
  it('favors the higher-rated player', () => {
    expect(expectedScore(1800, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1200, 1500)).toBeLessThan(0.5);
  });
  it('uses provisional K for new players, elite K at the top', () => {
    expect(kFactor({ games: 5, current: 1300 })).toBe(40);
    expect(kFactor({ games: 100, current: 1600 })).toBe(20);
    expect(kFactor({ games: 500, current: 2500 })).toBe(10);
  });
  it('raises the winner and lowers the loser', () => {
    const before = { games: 100, current: 1500 };
    const win = nextRating(before, 1500, MatchOutcome.WIN);
    const loss = nextRating(before, 1500, MatchOutcome.LOSS);
    expect(win).toBeGreaterThan(1500);
    expect(loss).toBeLessThan(1500);
  });
  it('awards more for beating a stronger opponent', () => {
    const s = { games: 100, current: 1500 };
    const vsStronger = nextRating(s, 1900, MatchOutcome.WIN) - 1500;
    const vsWeaker = nextRating(s, 1100, MatchOutcome.WIN) - 1500;
    expect(vsStronger).toBeGreaterThan(vsWeaker);
  });
  it('computePair is zero-sum-ish and symmetric', () => {
    const a = { games: 100, current: 1500 };
    const b = { games: 100, current: 1500 };
    const { aNew, bNew } = computePair(a, b, MatchOutcome.WIN);
    expect(aNew).toBeGreaterThan(1500);
    expect(bNew).toBeLessThan(1500);
    expect(aNew - 1500).toBe(1500 - bNew); // equal ratings → equal & opposite
  });
  it('never drops below the rating floor', () => {
    const s = { games: 100, current: 105 };
    expect(nextRating(s, 3000, MatchOutcome.LOSS)).toBeGreaterThanOrEqual(100);
  });
});
