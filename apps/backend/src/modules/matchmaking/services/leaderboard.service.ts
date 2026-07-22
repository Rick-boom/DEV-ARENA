import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import { LeaderboardUnavailableError } from '../errors/matchmaking-error.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { ILeaderboardStore, IUserDirectory } from '../interfaces/matchmaking.interfaces.js';
import {
  LeaderboardPeriod,
  LeaderboardScope,
  type LeaderboardPage,
} from '../types/matchmaking.types.js';
import { currentPeriods } from './period.util.js';

const log = createModuleLogger('leaderboard-service');
const { LEADERBOARD } = MM_CONSTANTS;

/**
 * Read side for all leaderboards. Resolves scope + period to the right
 * ZSET key and paginates. The FRIENDS board is computed per request
 * over the caller's friend id set (no per-graph ZSET), and COUNTRY /
 * COLLEGE boards are read from their grouped keys.
 */
export class LeaderboardService {
  constructor(
    private readonly store: ILeaderboardStore,
    private readonly users: IUserDirectory,
  ) {}

  private groupKey(period: LeaderboardPeriod, discriminator?: string): string {
    const { weekly, monthly } = currentPeriods();
    const suffix =
      period === LeaderboardPeriod.WEEKLY
        ? weekly
        : period === LeaderboardPeriod.MONTHLY
          ? monthly
          : 'all';
    return discriminator ? `${discriminator}:${suffix}` : suffix;
  }

  async getBoard(input: {
    scope: LeaderboardScope;
    period: LeaderboardPeriod;
    userId: string;
    country?: string;
    college?: string;
    page: number;
    pageSize: number;
  }): Promise<LeaderboardPage> {
    const pageSize = Math.min(input.pageSize, LEADERBOARD.PAGE_MAX);
    const offset = (input.page - 1) * pageSize;

    try {
      if (input.scope === LeaderboardScope.FRIENDS) {
        return await this.friendsBoard(input.userId, input.period, offset, pageSize, input.page);
      }
      const group = this.groupKey(
        input.period,
        input.scope === LeaderboardScope.COUNTRY
          ? (input.country ?? (await this.users.getCountry(input.userId)) ?? 'XX')
          : input.scope === LeaderboardScope.COLLEGE
            ? (input.college ?? (await this.users.getCollege(input.userId)) ?? 'unknown')
            : undefined,
      );
      const [entries, total] = await Promise.all([
        this.store.page(input.scope, group, input.period, offset, pageSize),
        this.store.count(input.scope, group, input.period),
      ]);
      return {
        scope: input.scope,
        period: input.period,
        group,
        entries,
        total,
        page: input.page,
        pageSize,
      };
    } catch (err) {
      log.error({ err, scope: input.scope }, 'leaderboard read failed');
      throw new LeaderboardUnavailableError();
    }
  }

  private async friendsBoard(
    userId: string,
    period: LeaderboardPeriod,
    offset: number,
    pageSize: number,
    page: number,
  ): Promise<LeaderboardPage> {
    const friends = await this.users.getFriendIds(userId);
    const ids = [...new Set([userId, ...friends])];
    const group = this.groupKey(period);
    const entries = await this.store.subsetPage(
      LeaderboardScope.GLOBAL,
      group,
      period,
      ids,
      offset,
      pageSize,
    );
    return {
      scope: LeaderboardScope.FRIENDS,
      period,
      group,
      entries,
      total: ids.length,
      page,
      pageSize,
    };
  }

  async rankOf(
    scope: LeaderboardScope,
    period: LeaderboardPeriod,
    userId: string,
    discriminator?: string,
  ) {
    const group = this.groupKey(period, discriminator);
    return this.store.rankOf(scope, group, period, userId);
  }
}
