import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

/**
 * One structured log line per request with latency and a requestId
 * that is also returned in the X-Request-Id header — the correlation
 * key between a user bug report and server logs.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  const startNs = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
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
