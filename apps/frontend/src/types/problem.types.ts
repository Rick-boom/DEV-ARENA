/** Problem catalogue + workspace domain types. */

export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const Language = {
  JAVASCRIPT: 'JAVASCRIPT',
  TYPESCRIPT: 'TYPESCRIPT',
  PYTHON: 'PYTHON',
  JAVA: 'JAVA',
  CPP: 'CPP',
} as const;
export type Language = (typeof Language)[keyof typeof Language];

/** Row shape for the explorer — deliberately lighter than the full problem. */
export interface ProblemSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  companies: string[];
  acceptedRate: number;
  totalSubmissions: number;
  solved: boolean;
  bookmarked: boolean;
}

export interface ProblemExample {
  id: string;
  input: string;
  output: string;
  explanation?: string;
}

export interface ProblemHint {
  id: string;
  order: number;
  content: string;
}

export interface ProblemEditorial {
  content: string;
  timeComplexity?: string;
  spaceComplexity?: string;
}

/** Public (non-hidden) test case shown in the workspace. */
export interface PublicTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  order: number;
}

export interface ProblemDetail extends ProblemSummary {
  statement: string;
  constraints: string[];
  examples: ProblemExample[];
  hints: ProblemHint[];
  /** Only present once the viewer is allowed to see it. */
  editorial?: ProblemEditorial;
  testCases: PublicTestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
  /** Per-language starter code from the server. */
  starterCode: Partial<Record<Language, string>>;
}

// ── explorer query ─────────────────────────────────────────────────
export const ProblemSort = {
  NEWEST: 'newest',
  TITLE: 'title',
  DIFFICULTY: 'difficulty',
  ACCEPTANCE: 'acceptance',
} as const;
export type ProblemSort = (typeof ProblemSort)[keyof typeof ProblemSort];

export const SolvedFilter = {
  ALL: 'all',
  SOLVED: 'solved',
  UNSOLVED: 'unsolved',
  BOOKMARKED: 'bookmarked',
} as const;
export type SolvedFilter = (typeof SolvedFilter)[keyof typeof SolvedFilter];

export interface ProblemQuery {
  search: string;
  difficulties: Difficulty[];
  tags: string[];
  companies: string[];
  status: SolvedFilter;
  sort: ProblemSort;
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── execution + judging ────────────────────────────────────────────
/** Result of a single "Run" against custom or sample input. */
export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  runtimeMs: number;
  memoryKb: number;
  timedOut: boolean;
  compileError?: string;
}

export const Verdict = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  ACCEPTED: 'ACCEPTED',
  WRONG_ANSWER: 'WRONG_ANSWER',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  OUTPUT_LIMIT_EXCEEDED: 'OUTPUT_LIMIT_EXCEEDED',
  PRESENTATION_ERROR: 'PRESENTATION_ERROR',
  SKIPPED: 'SKIPPED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];

/** Verdicts that mean judging is still in flight. */
export const PENDING_VERDICTS: Verdict[] = [Verdict.PENDING, Verdict.QUEUED, Verdict.RUNNING];

export interface SubmissionCaseResult {
  testCaseId: string;
  order: number;
  hidden: boolean;
  status: Verdict;
  runtimeMs: number | null;
  memoryKb: number | null;
  stderr?: string;
}

export interface Submission {
  id: string;
  problemId: string;
  language: Language;
  status: Verdict;
  runtimeMs: number | null;
  memoryKb: number | null;
  createdAt: string;
}

export interface SubmissionDetail extends Submission {
  passed: number;
  total: number;
  results: SubmissionCaseResult[];
}

// ── dashboard ──────────────────────────────────────────────────────
export interface ActivityEntry {
  id: string;
  kind: 'submission' | 'solved' | 'rating';
  problemTitle?: string;
  problemId?: string;
  verdict?: Verdict;
  delta?: number;
  at: string;
}

export interface LeaderboardRow {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rank: number;
  rating: number;
}

export interface DashboardSummary {
  solvedCount: number;
  attemptedCount: number;
  streakDays: number;
  byDifficulty: Record<Difficulty, { solved: number; total: number }>;
  /** The problem to resume, if any. */
  continueProblem: ProblemSummary | null;
  dailyChallenge: ProblemSummary | null;
  recent: ProblemSummary[];
  trending: ProblemSummary[];
  recommended: ProblemSummary[];
  activity: ActivityEntry[];
  leaderboard: LeaderboardRow[];
}
