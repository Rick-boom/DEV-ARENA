import type { Socket } from 'socket.io';
import type { Event } from 'socket.io';
import { env } from '../config/env.js';
import { RateLimitedError } from '../errors/socket-error.js';
import { createModuleLogger } from '../utils/logger.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/events.types.js';

const log = createModuleLogger('rate-limit');

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Per-socket, fixed-window rate limiter applied to EVERY inbound event
 * (socket.use runs before each handler). A fixed window is chosen over
 * a token bucket for O(1) state — two numbers on socket.data — which
 * matters at 50k connections. A flooding client is disconnected rather
 * than merely dropped, because a client emitting 10k/s is either
 * malicious or broken; keeping it wastes the node.
 */
export function registerRateLimiter(socket: TypedSocket): void {
  socket.use((_event: Event, next: (err?: Error) => void) => {
    const now = Date.now();
    const bucket = socket.data.rateBucket;
    if (now - bucket.windowStart >= env.RATE_LIMIT_WINDOW_MS) {
      bucket.windowStart = now;
      bucket.count = 0;
    }
    bucket.count += 1;
    if (bucket.count > env.RATE_LIMIT_MAX_EVENTS) {
      log.warn({ socketId: socket.id, userId: socket.data.user?.id }, 'rate limit exceeded');
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many events — slow down' });
      next(new RateLimitedError());
      socket.disconnect(true);
      return;
    }
    next();
  });
}
