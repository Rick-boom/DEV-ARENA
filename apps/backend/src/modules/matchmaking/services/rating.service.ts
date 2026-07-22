import { computePair } from '../elo/elo.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type {
  ILeaderboardStore,
  IMatchPublisher,
  IRatingStore,
  IUserDirectory,
} from '../interfaces/matchmaking.interfaces.js';
import {
  LeaderboardPeriod,
  LeaderboardScope,
  MatchOutcome,
  type RatingChange,
  type RatingStats,
} from '../types/matchmaking.types.js';
import { currentPeriods } from './period.util.js';

const log = createModuleLogger('rating-service');

/**
 * Applies a finished battle's outcome to ratings. This is the consumer
 * of the Battle Engine's "battle result" event. It computes Elo,
 * updates the live stat hashes (streaks, peak), appends to the rating
 * stream, persists durable history, refreshes every leaderboard the two
 * players belong to, and emits rating:update. Single responsibility:
 * turn a result into rating truth everywhere it's mirrored.
 */
export class RatingService {
  constructor(
    private readonly ratings: IRatingStore,
    private readonly leaderboards: ILeaderboardStore,
    private readonly users: IUserDirectory,
    private readonly publisher: IMatchPublisher,
  ) {}

  /**
   * @param winnerId null → draw.
   */
  async applyBattleResult(input: {
    battleId: string;
    playerA: string;
    playerB: string;
    winnerId: string | null;
    rated: boolean;
  }): Promise<{ a: RatingChange; b: RatingChange } | null> {
    if (!input.rated) {
      log.debug({ battleId: input.battleId }, 'unrated battle — no rating change');
      return null;
    }
    const [statsA, statsB] = await Promise.all([
      this.ratings.getStats(input.playerA),
      this.ratings.getStats(input.playerB),
    ]);

    const aOutcome =
      input.winnerId === null
        ? MatchOutcome.DRAW
        : input.winnerId === input.playerA
          ? MatchOutcome.WIN
          : MatchOutcome.LOSS;

    const { aNew, bNew } = computePair(statsA, statsB, aOutcome);

    const a = await this.commit(input, statsA, aNew, aOutcome);
    const b = await this.commit(
      input,
      statsB,
      bNew,
      aOutcome === MatchOutcome.WIN
        ? MatchOutcome.LOSS
        : aOutcome === MatchOutcome.LOSS
          ? MatchOutcome.WIN
          : MatchOutcome.DRAW,
    );
    return { a, b };
  }

  private async commit(
    input: { battleId: string },
    stats: RatingStats,
    newRating: number,
    outcome: MatchOutcome,
  ): Promise<RatingChange> {
    const updated = await this.ratings.applyResult({
      userId: stats.userId,
      newRating,
      won: outcome === MatchOutcome.WIN,
      draw: outcome === MatchOutcome.DRAW,
    });

    const change: RatingChange = {
      userId: stats.userId,
      oldRating: stats.current,
      newRating,
      change: newRating - stats.current,
      reason: 'battle',
      battleId: input.battleId,
      at: Date.now(),
    };
    await this.ratings.appendHistory(change);
    await this.users.persistRatingHistory(change); // durable Postgres audit
    await this.refreshLeaderboards(stats.userId, newRating);

    this.publisher.emitToUser(stats.userId, 'rating:update', {
      ...change,
      peak: updated.peak,
      winStreak: updated.winStreak,
      lossStreak: updated.lossStreak,
    });
    return change;
  }

  /** Update every board this user belongs to across all live periods. */
  private async refreshLeaderboards(userId: string, rating: number): Promise<void> {
    const [country, college] = await Promise.all([
      this.users.getCountry(userId),
      this.users.getCollege(userId),
    ]);
    const periods = [
      LeaderboardPeriod.WEEKLY,
      LeaderboardPeriod.MONTHLY,
      LeaderboardPeriod.ALL_TIME,
    ];
    const { weekly, monthly } = currentPeriods();

    for (const period of periods) {
      const groupSuffix =
        period === LeaderboardPeriod.WEEKLY
          ? weekly
          : period === LeaderboardPeriod.MONTHLY
            ? monthly
            : 'all';
      await this.leaderboards.upsertScore(
        LeaderboardScope.GLOBAL,
        groupSuffix,
        period,
        userId,
        rating,
      );
      if (country) {
        await this.leaderboards.upsertScore(
          LeaderboardScope.COUNTRY,
          `${country}:${groupSuffix}`,
          period,
          userId,
          rating,
        );
      }
      if (college) {
        await this.leaderboards.upsertScore(
          LeaderboardScope.COLLEGE,
          `${college}:${groupSuffix}`,
          period,
          userId,
          rating,
        );
      }
    }
    this.publisher.broadcast('leaderboard:update', { userId, rating });
  }

  getStats(userId: string): Promise<RatingStats> {
    return this.ratings.getStats(userId);
  }

  history(userId: string, limit: number): Promise<RatingChange[]> {
    return this.ratings.historyStream(userId, limit);
  }
}
