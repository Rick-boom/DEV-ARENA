import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middlewares/auth.middleware.js';
import { getValidated } from '../../../middlewares/validate.middleware.js';
import { UnauthorizedError } from '../../../errors/app-error.js';
import type {
  BattleActionDto,
  CreateBattleDto,
  FinishBattleDto,
  HistoryQueryDto,
  JoinBattleDto,
  RematchDto,
} from '../dto/battle-request.dto.js';
import type { BattleService } from '../services/battle.service.js';

/**
 * REST adapter. Thin: unwrap validated input + authenticated actor →
 * call one service method → wrap in the success envelope. No rules.
 */
export class BattleController {
  constructor(private readonly battles: BattleService) {}

  private actor(req: AuthenticatedRequest): { id: string } {
    if (!req.user) throw new UnauthorizedError();
    return { id: req.user.id };
  }

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<CreateBattleDto>(req, 'body');
      res
        .status(201)
        .json({ success: true, data: await this.battles.create(dto, this.actor(req)) });
    } catch (err) {
      next(err);
    }
  };

  join = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<JoinBattleDto>(req, 'body');
      res.json({ success: true, data: await this.battles.join(dto, this.actor(req)) });
    } catch (err) {
      next(err);
    }
  };

  start = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = getValidated<BattleActionDto>(req, 'body');
      res.json({
        success: true,
        data: await this.battles.startCountdown(battleId, this.actor(req)),
      });
    } catch (err) {
      next(err);
    }
  };

  pause = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<BattleActionDto>(req, 'body');
      res.json({ success: true, data: await this.battles.pause(dto, this.actor(req)) });
    } catch (err) {
      next(err);
    }
  };

  resume = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<BattleActionDto>(req, 'body');
      res.json({ success: true, data: await this.battles.resume(dto, this.actor(req)) });
    } catch (err) {
      next(err);
    }
  };

  finish = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<FinishBattleDto>(req, 'body');
      res.json({ success: true, data: await this.battles.finish(dto, this.actor(req)) });
    } catch (err) {
      next(err);
    }
  };

  rematch = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = getValidated<RematchDto>(req, 'body');
      res
        .status(201)
        .json({ success: true, data: await this.battles.rematch(battleId, this.actor(req)) });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      res.json({ success: true, data: await this.battles.getById(id) });
    } catch (err) {
      next(err);
    }
  };

  history = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, pageSize } = getValidated<HistoryQueryDto>(req, 'query');
      res.json({
        success: true,
        data: await this.battles.history(this.actor(req).id, page, pageSize),
      });
    } catch (err) {
      next(err);
    }
  };

  replay = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      res.json({ success: true, data: await this.battles.replay(id) });
    } catch (err) {
      next(err);
    }
  };
}
