/**
 * Operational errors for the socket layer. Each carries a stable
 * machine code that maps onto the Ack error envelope and the `error`
 * event. Unlike an HTTP service, there is no status code — a socket
 * error is delivered in-band — so the code is the contract.
 */
export class SocketError extends Error {
  public readonly code: string;
  public readonly isOperational = true;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Error.captureStackTrace(this, new.target);
  }
}

export class InvalidTokenError extends SocketError {
  constructor(message = 'Invalid or expired token') {
    super('INVALID_TOKEN', message);
  }
}
export class UnauthorizedError extends SocketError {
  constructor(message = 'Not authorized for this action') {
    super('UNAUTHORIZED', message);
  }
}
export class RoomNotFoundError extends SocketError {
  constructor(roomId: string) {
    super('ROOM_NOT_FOUND', `Room "${roomId}" was not found`);
  }
}
export class RoomFullError extends SocketError {
  constructor(roomId: string, capacity: number) {
    super('ROOM_FULL', `Room "${roomId}" is at capacity (${capacity})`);
  }
}
export class DuplicateConnectionError extends SocketError {
  constructor(max: number) {
    super('DUPLICATE_CONNECTION', `Connection limit reached (${max} per user)`);
  }
}
export class RateLimitedError extends SocketError {
  constructor() {
    super('RATE_LIMITED', 'Too many events — slow down');
  }
}
export class ValidationError extends SocketError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}
