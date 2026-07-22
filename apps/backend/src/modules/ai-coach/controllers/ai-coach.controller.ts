import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middlewares/auth.middleware.js';
import { getValidated } from '../../../middlewares/validate.middleware.js';
import { UnauthorizedError } from '../../../errors/app-error.js';
import { AiMode } from '../types/ai.types.js';
import type {
  ComplexityDto,
  HintDto,
  HistoryQueryDto,
  InterviewDto,
  LearningDto,
  RecommendDto,
  ReviewDto,
} from '../dto/ai.dto.js';
import type { AiCoachService } from '../services/ai-coach.service.js';

/** Thin REST adapter: unwrap validated input + actor → one service call. */
export class AiCoachController {
  constructor(private readonly service: AiCoachService) {}

  private uid(req: AuthenticatedRequest): string {
    if (!req.user) throw new UnauthorizedError();
    return req.user.id;
  }

  hint = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<HintDto>(req, 'body');
      const data = await this.service.coach({ userId: this.uid(req), mode: AiMode.HINT, ...dto });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  review = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<ReviewDto>(req, 'body');
      const data = await this.service.coach({ userId: this.uid(req), mode: AiMode.REVIEW, ...dto });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  complexity = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = getValidated<ComplexityDto>(req, 'body');
      const data = await this.service.coach({
        userId: this.uid(req),
        mode: AiMode.COMPLEXITY,
        ...dto,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  interview = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = getValidated<InterviewDto>(req, 'body');
      const data = await this.service.coach({
        userId: this.uid(req),
        mode: AiMode.INTERVIEW,
        ...dto,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  learning = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = getValidated<LearningDto>(req, 'body');
      const data = await this.service.coach({
        userId: this.uid(req),
        mode: AiMode.LEARNING,
        ...dto,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  recommend = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = getValidated<RecommendDto>(req, 'body');
      const data = await this.service.coach({
        userId: this.uid(req),
        mode: AiMode.RECOMMENDATION,
        ...dto,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  history = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit } = getValidated<HistoryQueryDto>(req, 'query');
      const data = await this.service.getHistory(this.uid(req), limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
