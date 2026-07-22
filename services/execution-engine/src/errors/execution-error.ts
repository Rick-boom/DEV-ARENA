/**
 * Error hierarchy for the execution service. Each operational error
 * maps to an HTTP status + stable machine code, so the API's error
 * middleware renders a uniform envelope. Non-ExecutionError throwables
 * are treated as bugs → 500 INTERNAL_ERROR with the stack logged.
 */
export class ExecutionError extends Error {
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

export class InvalidLanguageError extends ExecutionError {
  constructor(language: string) {
    super(400, 'INVALID_LANGUAGE', `Unsupported language: "${language}"`);
  }
}

export class ValidationError extends ExecutionError {
  constructor(details: unknown) {
    super(422, 'VALIDATION_ERROR', 'Request validation failed', details);
  }
}

export class CompilationFailedError extends ExecutionError {
  constructor(stderr: string) {
    super(200, 'COMPILATION_FAILED', 'Source failed to compile', { stderr });
  }
}

export class ContainerError extends ExecutionError {
  constructor(message: string, details?: unknown) {
    super(500, 'CONTAINER_ERROR', message, details);
  }
}

export class TimeoutError extends ExecutionError {
  constructor(limitMs: number) {
    super(200, 'TIMEOUT', `Execution exceeded the ${limitMs}ms time limit`);
  }
}

export class MemoryExceededError extends ExecutionError {
  constructor(limitMb: number) {
    super(200, 'MEMORY_EXCEEDED', `Execution exceeded the ${limitMb}MB memory limit`);
  }
}

export class QueueFullError extends ExecutionError {
  constructor(depth: number) {
    super(503, 'QUEUE_FULL', `Execution queue is at capacity (${depth} jobs). Retry shortly.`);
  }
}

export class InternalError extends ExecutionError {
  constructor(message = 'An unexpected error occurred') {
    super(500, 'INTERNAL_ERROR', message);
  }
}
