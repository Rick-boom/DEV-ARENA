import { AppError } from '../../../errors/app-error.js';

/** AI Coach operational errors, each mapped to a stable HTTP status + code. */
export class AIUnavailableError extends AppError {
  constructor(message = 'The AI coach is temporarily unavailable') {
    super(503, 'AI_UNAVAILABLE', message);
  }
}
export class PromptTooLargeError extends AppError {
  constructor() {
    super(413, 'PROMPT_TOO_LARGE', 'The code or question is too large to analyze');
  }
}
export class InvalidLanguageError extends AppError {
  constructor(language: string) {
    super(422, 'INVALID_LANGUAGE', `Unsupported language: ${language}`);
  }
}
export class RateLimitExceededError extends AppError {
  constructor() {
    super(429, 'RATE_LIMIT_EXCEEDED', 'Too many coaching requests — please slow down');
  }
}
export class CacheFailureError extends AppError {
  constructor() {
    super(500, 'CACHE_FAILURE', 'A caching error occurred');
  }
}
export class PromptInjectionError extends AppError {
  constructor() {
    super(
      400,
      'PROMPT_INJECTION_DETECTED',
      'Your input contained instructions that cannot be processed',
    );
  }
}
export class ContentBlockedError extends AppError {
  constructor() {
    super(400, 'CONTENT_BLOCKED', 'Your input was flagged by content moderation');
  }
}
export class ProblemNotFoundError extends AppError {
  constructor(problemId: string) {
    super(404, 'PROBLEM_NOT_FOUND', `Problem "${problemId}" was not found`);
  }
}
