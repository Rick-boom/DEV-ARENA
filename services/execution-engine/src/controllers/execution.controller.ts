import type { NextFunction, Request, Response } from 'express';
import { executeRequestSchema } from '../validators/execution.schema.js';
import { resolveLimits } from '../utils/resolve-limits.js';
import { ValidationError } from '../errors/execution-error.js';
import type { ExecutionQueue } from '../queue/execution.queue.js';
import type { ExecutionJobData } from '../types/execution.types.js';

/**
 * HTTP adapter for POST /execute. Thin by design: validate → resolve
 * limits → enqueue-and-wait → return the verdict envelope. All
 * security clamping and orchestration live below this layer.
 */
export class ExecutionController {
  constructor(private readonly queue: ExecutionQueue) {}

  execute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = executeRequestSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.flatten());
      const input = parsed.data;

      const limits = resolveLimits(input);
      const jobData: ExecutionJobData = {
        language: input.language,
        code: input.code,
        input: input.input,
        limits,
        submittedAt: Date.now(),
      };

      // Overall wait = compile ceiling + execution ceiling + headroom
      // for scheduling. Bounds the HTTP request regardless of backlog.
      const overallTimeoutMs = limits.compileMs + limits.timeLimitMs + 10_000;
      const result = await this.queue.enqueueAndWait(jobData, input.priority, overallTimeoutMs);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

/** Liveness/queue-depth endpoint for load balancers and dashboards. */
export class HealthController {
  constructor(private readonly queue: ExecutionQueue) {}

  health = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const counts = await this.queue.getJobCounts();
      res.json({ success: true, data: { status: 'ok', queue: counts } });
    } catch (err) {
      next(err);
    }
  };
}
