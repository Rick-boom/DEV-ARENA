import { AppError } from '../../../errors/app-error.js';

/**
 * Battle-specific operational errors. Each maps to a stable HTTP
 * status + machine code via the shared error middleware, so REST and
 * socket surfaces report failures identically.
 */
export class BattleNotFoundError extends AppError {
  constructor(id: string) {
    super(404, 'BATTLE_NOT_FOUND', `Battle "${id}" was not found`);
  }
}
export class RoomClosedError extends AppError {
  constructor() {
    super(409, 'ROOM_CLOSED', 'This room is closed and cannot be joined');
  }
}
export class RoomFullError extends AppError {
  constructor(capacity: number) {
    super(409, 'ROOM_FULL', `Room is at capacity (${capacity})`);
  }
}
export class AlreadyJoinedError extends AppError {
  constructor() {
    super(409, 'ALREADY_JOINED', 'You have already joined this battle');
  }
}
export class BattleFinishedError extends AppError {
  constructor() {
    super(409, 'BATTLE_FINISHED', 'This battle has already finished');
  }
}
export class InvalidInviteError extends AppError {
  constructor() {
    super(403, 'INVALID_INVITE', 'Invite link is invalid or has expired');
  }
}
export class NotHostError extends AppError {
  constructor() {
    super(403, 'NOT_HOST', 'Only the battle host can perform this action');
  }
}
export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(409, 'INVALID_TRANSITION', `Cannot move battle from ${from} to ${to}`);
  }
}
export class ReplayProtectionError extends AppError {
  constructor() {
    super(409, 'REPLAY_DETECTED', 'Duplicate or out-of-order action rejected');
  }
}
