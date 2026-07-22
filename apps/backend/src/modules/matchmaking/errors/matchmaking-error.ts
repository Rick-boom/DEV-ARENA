import { AppError } from '../../../errors/app-error.js';

export class AlreadyQueuedError extends AppError {
  constructor() {
    super(409, 'ALREADY_QUEUED', 'You are already in the matchmaking queue');
  }
}
export class QueueTimeoutError extends AppError {
  constructor() {
    super(408, 'QUEUE_TIMEOUT', 'No opponent found before the queue timed out');
  }
}
export class MatchNotFoundError extends AppError {
  constructor(id: string) {
    super(404, 'MATCH_NOT_FOUND', `Match "${id}" was not found`);
  }
}
export class LeaderboardUnavailableError extends AppError {
  constructor() {
    super(503, 'LEADERBOARD_UNAVAILABLE', 'Leaderboard is temporarily unavailable');
  }
}
export class NotQueuedError extends AppError {
  constructor() {
    super(404, 'NOT_QUEUED', 'You are not currently in the queue');
  }
}
export class RateLimitedError extends AppError {
  constructor() {
    super(429, 'RATE_LIMITED', 'Too many queue requests — slow down');
  }
}
export class InvalidQueueError extends AppError {
  constructor(message: string) {
    super(422, 'INVALID_QUEUE', message);
  }
}
