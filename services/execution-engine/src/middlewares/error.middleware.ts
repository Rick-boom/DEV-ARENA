import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ExecutionError, ValidationError } from '../errors/execution-error.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('error-handler');

/**
 * Terminal error middleware — the ONLY place errors become HTTP
 * responses, guaranteeing a uniform envelope. ZodErrors → 422;
 * operational ExecutionErrors → their status/code; anything else → 500
 * with a generic body (internals never leak) and a logged stack.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) err = new ValidationError(err.flatten());

  if (err instanceof ExecutionError) {
    log.warn({ code: err.code, status: err.statusCode, path: req.path }, err.message);
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  log.error({ err, path: req.path }, 'unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
