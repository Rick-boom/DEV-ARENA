import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors/app-error.js';
import { createModuleLogger } from '../lib/logger.js';

const log = createModuleLogger('error-handler');

/**
 * Terminal error middleware — the ONLY place errors become HTTP
 * responses, so the ApiError envelope is guaranteed uniform.
 * Operational AppErrors → their status/code (logged at warn).
 * ZodErrors that escaped a validator → 422.
 * Everything else → 500 with a generic body (internals never leak),
 * full stack logged at error level for the on-call engineer.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    err = new ValidationError(err.flatten());
  }

  if (err instanceof AppError) {
    log.warn(
      { code: err.code, status: err.statusCode, path: req.path, method: req.method },
      err.message,
    );
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  log.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
