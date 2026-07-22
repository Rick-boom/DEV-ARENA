import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

/** One structured line per request with latency + a correlation id. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  const start = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
      },
      'http.request',
    );
  });
  next();
}
