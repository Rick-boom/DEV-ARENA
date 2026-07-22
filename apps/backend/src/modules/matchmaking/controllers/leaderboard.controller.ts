import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middlewares/auth.middleware.js';
import { getValidated } from '../../../middlewares/validate.middleware.js';
import { UnauthorizedError } from '../../../errors/app-error.js';
import { LeaderboardScope } from '../types/matchmaking.types.js';
import type { LeaderboardQueryDto, RatingHistoryQueryDto } from '../dto/matchmaking.dto.js';
import type { LeaderboardService } from '../services/leaderboard.service.js';
import type { RatingService } from '../services/rating.service.js';

/** Thin REST adapter for leaderboard + rating reads. */
export class LeaderboardController {
  constructor(
    private readonly leaderboards: LeaderboardService,
    private readonly ratings: RatingService,
  ) {}

  private uid(req: AuthenticatedRequest): string {
    if (!req.user) throw new UnauthorizedError();
    return req.user.id;
  }

  board = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = getValidated<LeaderboardQueryDto>(req, 'query');
      const data = await this.leaderboards.getBoard({
        scope: q.scope,
        period: q.period,
        userId: this.uid(req),
        country: q.country,
        college: q.college,
        page: q.page,
        pageSize: q.pageSize,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  global = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = getValidated<LeaderboardQueryDto>(req, 'query');
      const data = await this.leaderboards.getBoard({
        scope: LeaderboardScope.GLOBAL,
        period: q.period,
        userId: this.uid(req),
        page: q.page,
        pageSize: q.pageSize,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  friends = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = getValidated<LeaderboardQueryDto>(req, 'query');
      const data = await this.leaderboards.getBoard({
        scope: LeaderboardScope.FRIENDS,
        period: q.period,
        userId: this.uid(req),
        page: q.page,
        pageSize: q.pageSize,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  ratingHistory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { limit } = getValidated<RatingHistoryQueryDto>(req, 'query');
      const [stats, history] = await Promise.all([
        this.ratings.getStats(this.uid(req)),
        this.ratings.history(this.uid(req), limit),
      ]);
      res.json({ success: true, data: { stats, history } });
    } catch (err) {
      next(err);
    }
  };
}
