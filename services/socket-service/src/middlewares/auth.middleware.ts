import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { env } from '../config/env.js';
import { InvalidTokenError } from '../errors/socket-error.js';
import { createModuleLogger } from '../utils/logger.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/events.types.js';

const log = createModuleLogger('auth-middleware');

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface AccessTokenPayload {
  sub: string;
  role: string;
  username?: string;
}

/**
 * JWT handshake authentication. Runs ONCE, before connection is
 * accepted — an unauthenticated socket never reaches a handler. The
 * token is read from the handshake auth field (preferred) or the
 * Authorization header. We only VERIFY with the shared access secret;
 * issuing tokens is the auth module's job. The decoded identity is
 * pinned to socket.data so handlers can trust it implicitly.
 */
export function createAuthMiddleware() {
  return (socket: TypedSocket, next: (err?: Error) => void): void => {
    try {
      const token = extractToken(socket);
      if (!token) throw new InvalidTokenError('No token provided');
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
      if (!payload.sub) throw new InvalidTokenError('Malformed token');

      socket.data.user = {
        id: payload.sub,
        role: payload.role ?? 'USER',
        username: payload.username ?? payload.sub,
      };
      socket.data.lastNonce = 0;
      socket.data.rateBucket = { windowStart: Date.now(), count: 0 };
      next();
    } catch (err) {
      log.warn({ err: (err as Error).message, socketId: socket.id }, 'handshake auth failed');
      next(err instanceof InvalidTokenError ? err : new InvalidTokenError());
    }
  };
}

function extractToken(socket: TypedSocket): string | null {
  const authField = socket.handshake.auth?.token as string | undefined;
  if (authField) return authField.replace(/^Bearer\s+/i, '');
  const header = socket.handshake.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}
