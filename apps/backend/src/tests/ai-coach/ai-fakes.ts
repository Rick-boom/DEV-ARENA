import type {
  IAiInteractionRepository,
  IContentModerator,
  ILLMClient,
  IPromptCache,
  IProblemContextProvider,
  IRateLimiter,
  ISubmissionContextProvider,
  LLMRequest,
  LLMResult,
} from '../../modules/ai-coach/interfaces/ai.interfaces.js';
import type {
  CoachResponse,
  InteractionRecord,
  ProblemContext,
  SubmissionContext,
} from '../../modules/ai-coach/types/ai.types.js';

/** Fakes so the full AI pipeline runs with no Gemini, Redis, or Prisma. */

export class FakeLLM implements ILLMClient {
  calls: LLMRequest[] = [];
  nextText = JSON.stringify({
    summary: 'Think about a hash map.',
    points: ['Consider O(n) lookups.'],
  });
  blocked = false;
  shouldThrow: Error | null = null;

  async complete(input: LLMRequest): Promise<LLMResult> {
    this.calls.push(input);
    if (this.shouldThrow) throw this.shouldThrow;
    return {
      text: this.nextText,
      model: input.model,
      tokensIn: 100,
      tokensOut: 50,
      blocked: this.blocked,
    };
  }
}

export class FakeProblemProvider implements IProblemContextProvider {
  problem: ProblemContext | null = {
    problemId: '11111111-1111-4111-8111-111111111111',
    title: 'Two Sum',
    statement: 'Return indices of two numbers that add up to target.',
    constraints: '2 <= n <= 10^4',
    difficulty: 'EASY',
    topics: ['arrays', 'hashmap'],
    editorialText:
      'Use a hash map to store seen values and check the complement in one pass over the array.',
    hiddenTestInputs: ['SECRET_HIDDEN_INPUT_42'],
  };
  async getProblem(): Promise<ProblemContext | null> {
    return this.problem;
  }
}

export class FakeSubmissionProvider implements ISubmissionContextProvider {
  submission: SubmissionContext | null = {
    code: 'function f(a){ for(let i=0;i<a.length;i++){} }',
    language: 'javascript',
    verdict: 'WRONG_ANSWER',
    runtimeMs: 42,
    memoryKb: 1024,
    recentVerdicts: ['WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED'],
  };
  weak = ['dynamic-programming', 'graphs'];
  solved = ['arrays'];
  candidates = [{ problemId: 'p2', title: 'Coin Change', topic: 'dynamic-programming' }];

  async getLatestSubmission(): Promise<SubmissionContext | null> {
    return this.submission;
  }
  async getWeakTopics(): Promise<string[]> {
    return this.weak;
  }
  async getSolvedTopics(): Promise<string[]> {
    return this.solved;
  }
  async suggestProblems(): Promise<{ problemId: string; title: string; topic: string }[]> {
    return this.candidates;
  }
}

export class FakeCache implements IPromptCache {
  store = new Map<string, CoachResponse>();
  hits = 0;
  misses = 0;
  async getResponse(key: string): Promise<CoachResponse | null> {
    return this.store.get(key) ?? null;
  }
  async setResponse(key: string, value: CoachResponse): Promise<void> {
    this.store.set(key, value);
  }
  async recordHit(): Promise<void> {
    this.hits += 1;
  }
  async recordMiss(): Promise<void> {
    this.misses += 1;
  }
  async hitRatio(): Promise<{ hits: number; misses: number; ratio: number }> {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, ratio: total ? this.hits / total : 0 };
  }
}

export class FakeHistory implements IAiInteractionRepository {
  records = new Map<string, InteractionRecord[]>();
  async append(userId: string, record: InteractionRecord): Promise<void> {
    if (!this.records.has(userId)) this.records.set(userId, []);
    this.records.get(userId)!.unshift(record);
  }
  async list(userId: string, limit: number): Promise<InteractionRecord[]> {
    return (this.records.get(userId) ?? []).slice(0, limit);
  }
}

export class FakeRateLimiter implements IRateLimiter {
  counts = new Map<string, number>();
  limit = 1000;
  async hit(key: string): Promise<boolean> {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n <= this.limit;
  }
}

export class PassModerator implements IContentModerator {
  isAllowed(): { allowed: boolean; reason?: string } {
    return { allowed: true };
  }
}

/** Minimal Redis-like stub for the hint-level counter the service uses. */
export class FakeRedis {
  private nums = new Map<string, number>();
  async incr(key: string): Promise<number> {
    const n = (this.nums.get(key) ?? 0) + 1;
    this.nums.set(key, n);
    return n;
  }
  async expire(): Promise<number> {
    return 1;
  }
}
