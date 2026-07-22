/**
 * Error hierarchy for the whole API. Every operational error carries
 * an HTTP status + stable machine code that maps 1:1 onto the
 * ApiError envelope from @devarena/shared-types. Anything that is NOT
 * an AppError is treated as a bug (500, logged with stack).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class ProblemNotFoundError extends AppError {
  constructor(idOrSlug: string) {
    super(404, 'PROBLEM_NOT_FOUND', `Problem "${idOrSlug}" was not found`);
  }
}

export class DuplicateProblemError extends AppError {
  constructor(field: 'slug' | 'title', value: string) {
    super(409, 'DUPLICATE_PROBLEM', `A problem with this ${field} already exists: "${value}"`);
  }
}

export class VersionConflictError extends AppError {
  constructor(expected: number, actual: number) {
    super(
      409,
      'VERSION_CONFLICT',
      `Problem was modified by someone else (your version ${expected}, current ${actual}). Reload and retry.`,
    );
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(422, 'VALIDATION_ERROR', 'Request validation failed', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} was not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}
