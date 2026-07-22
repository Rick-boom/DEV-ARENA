import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middlewares/auth.middleware.js';
import { getValidated } from '../../../middlewares/validate.middleware.js';
import { UnauthorizedError } from '../../../errors/app-error.js';
import type { JoinQueueDto } from '../dto/matchmaking.dto.js';
import type { MatchmakingService } from '../services/matchmaking.service.js';

/** Thin REST adapter for queue operations. */
export class MatchmakingController {
  constructor(private readonly service: MatchmakingService) {}

  private uid(req: AuthenticatedRequest): string {
    if (!req.user) throw new UnauthorizedError();
    return req.user.id;
  }

  join = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<JoinQueueDto>(req, 'body');
      const data = await this.service.join({ userId: this.uid(req), ...dto });
      res.status(202).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  leave = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.leave(this.uid(req));
      res.json({ success: true, data: { left: true } });
    } catch (err) {
      next(err);
    }
  };

  status = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.service.status(this.uid(req)) });
    } catch (err) {
      next(err);
    }
  };

  reconnect = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      res.json({ success: true, data: await this.service.reconnect(this.uid(req)) });
    } catch (err) {
      next(err);
    }
  };
}
