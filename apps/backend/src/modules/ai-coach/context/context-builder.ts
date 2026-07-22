import { AI_CONSTANTS, type SupportedLanguage } from '../constants/ai.constants.js';
import { InvalidLanguageError, ProblemNotFoundError } from '../errors/ai-error.js';
import { redactPII } from './pii-filter.js';
import type {
  IProblemContextProvider,
  ISubmissionContextProvider,
} from '../interfaces/ai.interfaces.js';
import { AiMode, type CoachContext, type CoachRequest } from '../types/ai.types.js';

/**
 * Assembles the grounded CoachContext from the assumed Problem +
 * Submission/History services. This is the "Context Builder" stage: it
 * pulls only the metadata each mode needs, redacts PII from user code,
 * validates the language, and derives weak/solved topics for the
 * learning + recommendation modes. It NEVER pulls editorial/hidden tests
 * into the prompt path — those are attached only so the validator can
 * detect leaks.
 */
export class ContextBuilder {
  constructor(
    private readonly problems: IProblemContextProvider,
    private readonly submissions: ISubmissionContextProvider,
  ) {}

  async build(req: CoachRequest): Promise<{ ctx: CoachContext; piiFound: string[] }> {
    const problem = await this.problems.getProblem(req.problemId);
    if (!problem) throw new ProblemNotFoundError(req.problemId);

    const piiFound: string[] = [];
    const ctx: CoachContext = { problem };

    // Modes that reason about the user's code need the submission.
    const needsCode =
      req.mode === AiMode.HINT ||
      req.mode === AiMode.COMPLEXITY ||
      req.mode === AiMode.REVIEW ||
      req.mode === AiMode.INTERVIEW;

    if (needsCode) {
      let code = req.code ?? '';
      let language = req.language;

      // Fall back to the latest stored submission if the caller didn't inline code.
      if (!code) {
        const latest = await this.submissions.getLatestSubmission(req.userId, req.problemId);
        if (latest) {
          code = latest.code;
          language = latest.language;
          ctx.submission = latest;
        }
      }
      if (language && !AI_CONSTANTS.SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
        throw new InvalidLanguageError(language);
      }
      if (code.length > AI_CONSTANTS.LIMITS.MAX_CODE_CHARS) {
        code = code.slice(0, AI_CONSTANTS.LIMITS.MAX_CODE_CHARS);
      }
      if (code) {
        const { redacted, found } = redactPII(code);
        piiFound.push(...found);
        ctx.submission = {
          ...(ctx.submission ?? {
            code: '',
            language: (language ?? 'javascript') as SupportedLanguage,
          }),
          code: redacted,
          language: (language ?? ctx.submission?.language ?? 'javascript') as SupportedLanguage,
        };
      }
    }

    // Learning + recommendation need the user's topic profile.
    if (req.mode === AiMode.LEARNING || req.mode === AiMode.RECOMMENDATION) {
      ctx.weakTopics = await this.submissions.getWeakTopics(req.userId);
      ctx.solvedTopics = await this.submissions.getSolvedTopics(req.userId);
    }

    return { ctx, piiFound };
  }
}
