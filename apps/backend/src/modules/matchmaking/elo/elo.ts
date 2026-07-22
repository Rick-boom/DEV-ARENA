import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import { MatchOutcome, type RatingStats } from '../types/matchmaking.types.js';

const { RATING } = MM_CONSTANTS;

/**
 * Pure Elo math — no I/O, fully unit-testable. Kept separate from the
 * rating SERVICE (which persists) so the algorithm can be reasoned
 * about and swapped (Glicko-2 later) without touching storage.
 *
 * Elo models the probability that A beats B from the rating gap, then
 * nudges each rating toward the actual result scaled by K. K shrinks as
 * a player accrues games / climbs, so ratings stabilize at the top and
 * move fast for newcomers.
 */
export function expectedScore(self: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - self) / 400));
}

export function kFactor(stats: Pick<RatingStats, 'games' | 'current'>): number {
  if (stats.games < RATING.PROVISIONAL_GAMES) return RATING.K_PROVISIONAL;
  if (stats.current >= RATING.ELITE_THRESHOLD) return RATING.K_ELITE;
  return RATING.K_STANDARD;
}

function scoreOf(outcome: MatchOutcome): number {
  if (outcome === MatchOutcome.WIN) return 1;
  if (outcome === MatchOutcome.DRAW) return 0.5;
  return 0;
}

/** New rating for `self` after a game vs `opponentRating`. */
export function nextRating(
  stats: Pick<RatingStats, 'games' | 'current'>,
  opponentRating: number,
  outcome: MatchOutcome,
): number {
  const expected = expectedScore(stats.current, opponentRating);
  const k = kFactor(stats);
  const delta = Math.round(k * (scoreOf(outcome) - expected));
  return Math.max(RATING.FLOOR, stats.current + delta);
}

/** Symmetric helper: compute both players' new ratings in one call. */
export function computePair(
  a: Pick<RatingStats, 'games' | 'current'>,
  b: Pick<RatingStats, 'games' | 'current'>,
  aOutcome: MatchOutcome,
): { aNew: number; bNew: number } {
  const bOutcome =
    aOutcome === MatchOutcome.WIN
      ? MatchOutcome.LOSS
      : aOutcome === MatchOutcome.LOSS
        ? MatchOutcome.WIN
        : MatchOutcome.DRAW;
  return {
    aNew: nextRating(a, b.current, aOutcome),
    bNew: nextRating(b, a.current, bOutcome),
  };
}
