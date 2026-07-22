import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

/**
 * Consumes access tokens minted by the (already implemented) auth
 * module. This file deliberately contains NO login/refresh logic —
 * it only verifies and attaches identity.
 */
export interface AuthUser {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface AccessTokenPayload {
  sub: string;
  role: Role;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

function verifyToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (!payload.sub || !payload.role) throw new UnauthorizedError('Malformed token');
    return { id: payload.sub, role: payload.role };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/** Hard gate: request fails 401 without a valid token. */
export const requireAuth: RequestHandler = (req: AuthenticatedRequest, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    next(new UnauthorizedError());
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Soft gate: attaches user when a valid token is present, continues
 * anonymously otherwise. Used by public listings so logged-in users
 * get solved/bookmarked flags while guests still get content.
 */
export const optionalAuth: RequestHandler = (req: AuthenticatedRequest, _res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // Invalid token on a public route: treat as anonymous, don't 401.
    }
  }
  next();
};

/** Role gate — compose after requireAuth. Admin implies moderator. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
