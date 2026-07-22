import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middlewares/auth.middleware.js';
import { getValidated } from '../../../middlewares/validate.middleware.js';
import { UnauthorizedError } from '../../../errors/app-error.js';
import type {
  CreateSubmissionDto,
  HistoryQueryDto,
  ResultQueryDto,
  SubmissionIdDto,
} from '../dto/judge.dto.js';
import type { SubmissionService } from '../services/submission.service.js';
import type { PrismaClient } from '@prisma/client';

/** Thin REST adapter: validate → service → envelope. */
export class JudgeController {
  constructor(
    private readonly service: SubmissionService,
    private readonly prisma: PrismaClient,
  ) {}

  private uid(req: AuthenticatedRequest): string {
    if (!req.user) throw new UnauthorizedError();
    return req.user.id;
  }

  /** POST /submission — accepted async; returns the id to poll/subscribe. */
  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = getValidated<CreateSubmissionDto>(req, 'body');
      const data = await this.service.submit({ userId: this.uid(req), ...dto });
      res.status(202).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /submission/history — the caller's recent submissions. */
  history = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, offset } = getValidated<HistoryQueryDto>(req, 'query');
      const data = await this.service.history(this.uid(req), limit, offset);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /submission/result?submissionId=… — full per-test-case breakdown. */
  result = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { submissionId } = getValidated<ResultQueryDto>(req, 'query');
      const submission = await this.service.getSubmission(submissionId);
      const results = await this.prisma.submissionResult.findMany({
        where: { submissionId },
        select: { testCaseId: true, status: true, runtimeMs: true, memoryKb: true, stderr: true },
      });
      // Hidden-case details are never exposed beyond pass/fail + timing.
      const hidden = await this.prisma.testCase.findMany({
        where: { id: { in: results.map((r) => r.testCaseId) } },
        select: { id: true, isHidden: true, order: true },
      });
      const hiddenById = new Map(hidden.map((h) => [h.id, h]));
      res.json({
        success: true,
        data: {
          submissionId,
          status: submission.status,
          results: results.map((r) => ({
            testCaseId: r.testCaseId,
            order: hiddenById.get(r.testCaseId)?.order ?? 0,
            hidden: hiddenById.get(r.testCaseId)?.isHidden ?? true,
            status: r.status,
            runtimeMs: r.runtimeMs,
            memoryKb: r.memoryKb,
            stderr: hiddenById.get(r.testCaseId)?.isHidden ? undefined : r.stderr,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /** GET /submission/:id — status + metadata (must be last: param route). */
  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<SubmissionIdDto>(req, 'params');
      const data = await this.service.getSubmission(id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
