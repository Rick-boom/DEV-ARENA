import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors/app-error.js';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory. Parses (and TRANSFORMS —
 * coercion, defaults, trimming) one part of the request, then
 * replaces that part with the parsed output so downstream code only
 * ever sees clean, typed data. Fail → 422 with field-level details.
 */
export function validate(part: RequestPart, schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new ValidationError(result.error.flatten()));
      return;
    }
    // Express 5 makes req.query a getter; store parsed output where
    // controllers can reach it without mutating the getter.
    (req as Request & { validated?: Partial<Record<RequestPart, unknown>> }).validated = {
      ...(req as Request & { validated?: Partial<Record<RequestPart, unknown>> }).validated,
      [part]: result.data,
    };
    next();
  };
}

/** Typed accessor for data produced by `validate()`. */
export function getValidated<T>(req: Request, part: RequestPart): T {
  const store = (req as Request & { validated?: Partial<Record<RequestPart, unknown>> }).validated;
  return store?.[part] as T;
}
