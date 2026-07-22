import { describe, expect, it, beforeEach } from 'vitest';
import { RatingService } from '../../modules/matchmaking/services/rating.service.js';
import { LeaderboardService } from '../../modules/matchmaking/services/leaderboard.service.js';
import {
  LeaderboardPeriod,
  LeaderboardScope,
} from '../../modules/matchmaking/types/matchmaking.types.js';
import {
  FakeLeaderboardStore,
  FakePublisher,
  FakeRatingStore,
  FakeUserDirectory,
} from './mm-fakes.js';

describe('RatingService', () => {
  let ratings: FakeRatingStore;
  let boards: FakeLeaderboardStore;
  let users: FakeUserDirectory;
  let publisher: FakePublisher;
  let service: RatingService;

  beforeEach(() => {
    ratings = new FakeRatingStore();
    boards = new FakeLeaderboardStore();
    users = new FakeUserDirectory();
    publisher = new FakePublisher();
    service = new RatingService(ratings, boards, users, publisher);
  });

  it('applies a win/loss, updating both ratings in opposite directions', async () => {
    ratings.stats.set('a', {
      userId: 'a',
      current: 1500,
      peak: 1500,
      games: 50,
      wins: 25,
      losses: 25,
      winStreak: 0,
      lossStreak: 0,
    });
    ratings.stats.set('b', {
      userId: 'b',
      current: 1500,
      peak: 1500,
      games: 50,
      wins: 25,
      losses: 25,
      winStreak: 0,
      lossStreak: 0,
    });

    const result = await service.applyBattleResult({
      battleId: 'btl-1',
      playerA: 'a',
      playerB: 'b',
      winnerId: 'a',
      rated: true,
    });
    expect(result).not.toBeNull();
    expect(result!.a.change).toBeGreaterThan(0);
    expect(result!.b.change).toBeLessThan(0);
    expect((await ratings.getStats('a')).winStreak).toBe(1);
    expect((await ratings.getStats('b')).lossStreak).toBe(1);
  });

  it('tracks peak rating', async () => {
    ratings.stats.set('a', {
      userId: 'a',
      current: 1500,
      peak: 1500,
      games: 50,
      wins: 0,
      losses: 0,
      winStreak: 0,
      lossStreak: 0,
    });
    ratings.stats.set('b', {
      userId: 'b',
      current: 1500,
      peak: 1500,
      games: 50,
      wins: 0,
      losses: 0,
      winStreak: 0,
      lossStreak: 0,
    });
    await service.applyBattleResult({
      battleId: 'b1',
      playerA: 'a',
      playerB: 'b',
      winnerId: 'a',
      rated: true,
    });
    const a = await ratings.getStats('a');
    expect(a.peak).toBeGreaterThanOrEqual(a.current);
    expect(a.peak).toBeGreaterThan(1500);
  });

  it('persists durable history and emits rating:update to both', async () => {
    await service.applyBattleResult({
      battleId: 'b1',
      playerA: 'a',
      playerB: 'b',
      winnerId: 'a',
      rated: true,
    });
    expect(users.persisted).toHaveLength(2);
    expect(publisher.eventsFor('a', 'rating:update')).toHaveLength(1);
    expect(publisher.eventsFor('b', 'rating:update')).toHaveLength(1);
  });

  it('updates the global leaderboard for both players', async () => {
    await service.applyBattleResult({
      battleId: 'b1',
      playerA: 'a',
      playerB: 'b',
      winnerId: 'a',
      rated: true,
    });
    const rankA = await boards.rankOf(
      LeaderboardScope.GLOBAL,
      'all',
      LeaderboardPeriod.ALL_TIME,
      'a',
    );
    expect(rankA).not.toBeNull();
  });

  it('skips rating changes for unrated battles', async () => {
    const result = await service.applyBattleResult({
      battleId: 'b1',
      playerA: 'a',
      playerB: 'b',
      winnerId: 'a',
      rated: false,
    });
    expect(result).toBeNull();
    expect(users.persisted).toHaveLength(0);
  });

  it('handles a draw (no winner)', async () => {
    ratings.stats.set('a', {
      userId: 'a',
      current: 1600,
      peak: 1600,
      games: 50,
      wins: 0,
      losses: 0,
      winStreak: 3,
      lossStreak: 0,
    });
    ratings.stats.set('b', {
      userId: 'b',
      current: 1400,
      peak: 1400,
      games: 50,
      wins: 0,
      losses: 0,
      winStreak: 0,
      lossStreak: 2,
    });
    const result = await service.applyBattleResult({
      battleId: 'b1',
      playerA: 'a',
      playerB: 'b',
      winnerId: null,
      rated: true,
    });
    // Higher-rated player loses a little on a draw; lower-rated gains.
    expect(result!.a.change).toBeLessThanOrEqual(0);
    expect(result!.b.change).toBeGreaterThanOrEqual(0);
    // Draw breaks the win streak.
    expect((await ratings.getStats('a')).winStreak).toBe(0);
  });
});

describe('LeaderboardService', () => {
  let boards: FakeLeaderboardStore;
  let users: FakeUserDirectory;
  let service: LeaderboardService;

  beforeEach(async () => {
    boards = new FakeLeaderboardStore();
    users = new FakeUserDirectory();
    service = new LeaderboardService(boards, users);
    // seed an ALL_TIME global board
    await boards.upsertScore('GLOBAL', 'all', 'ALL_TIME', 'a', 1800);
    await boards.upsertScore('GLOBAL', 'all', 'ALL_TIME', 'b', 1600);
    await boards.upsertScore('GLOBAL', 'all', 'ALL_TIME', 'c', 2000);
  });

  it('returns a global board ordered by score desc with ranks', async () => {
    const page = await service.getBoard({
      scope: LeaderboardScope.GLOBAL,
      period: LeaderboardPeriod.ALL_TIME,
      userId: 'a',
      page: 1,
      pageSize: 10,
    });
    expect(page.entries.map((e) => e.userId)).toEqual(['c', 'a', 'b']);
    expect(page.entries[0]!.rank).toBe(1);
    expect(page.total).toBe(3);
  });

  it('paginates', async () => {
    const page = await service.getBoard({
      scope: LeaderboardScope.GLOBAL,
      period: LeaderboardPeriod.ALL_TIME,
      userId: 'a',
      page: 2,
      pageSize: 1,
    });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]!.userId).toBe('a'); // 2nd place
    expect(page.entries[0]!.rank).toBe(2);
  });

  it('builds a friends board from the caller friend set', async () => {
    users.friends.set('a', ['b']); // a's friends = [b]; board includes a + b
    const page = await service.getBoard({
      scope: LeaderboardScope.FRIENDS,
      period: LeaderboardPeriod.ALL_TIME,
      userId: 'a',
      page: 1,
      pageSize: 10,
    });
    const ids = page.entries.map((e) => e.userId).sort();
    expect(ids).toEqual(['a', 'b']);
    expect(page.scope).toBe(LeaderboardScope.FRIENDS);
  });
});
