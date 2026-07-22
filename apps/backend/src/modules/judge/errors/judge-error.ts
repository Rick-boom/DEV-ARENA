import { AppError } from '../../../errors/app-error.js';

/** Judge operational errors, each mapped to a stable HTTP status + code. */
export class SubmissionNotFoundError extends AppError {
  constructor(id: string) {
    super(404, 'SUBMISSION_NOT_FOUND', `Submission "${id}" was not found`);
  }
}
export class ProblemNotJudgeableError extends AppError {
  constructor(problemId: string) {
    super(422, 'PROBLEM_NOT_JUDGEABLE', `Problem "${problemId}" has no test cases`);
  }
}
export class DuplicateSubmissionError extends AppError {
  constructor() {
    super(
      409,
      'DUPLICATE_SUBMISSION',
      'Identical code was just submitted — please wait before retrying',
    );
  }
}
export class RateLimitExceededError extends AppError {
  constructor() {
    super(429, 'RATE_LIMIT_EXCEEDED', 'Too many submissions — please slow down');
  }
}
export class UnsupportedLanguageError extends AppError {
  constructor(language: string) {
    super(422, 'UNSUPPORTED_LANGUAGE', `Language "${language}" is not supported`);
  }
}
export class ExecutionUnavailableError extends AppError {
  constructor() {
    super(503, 'EXECUTION_UNAVAILABLE', 'The execution engine is temporarily unavailable');
  }
}
export class JudgeInternalError extends AppError {
  constructor(message = 'Internal judging error') {
    super(500, 'JUDGE_INTERNAL_ERROR', message);
  }
}
