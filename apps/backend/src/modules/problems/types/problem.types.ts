import type {
  Company,
  Difficulty,
  Problem,
  ProblemCompany,
  ProblemConstraint,
  ProblemEditorial,
  ProblemExample,
  ProblemHint,
  ProblemTag,
  ProblemVersion,
  ProblemVisibility,
  Tag,
  TestCase,
} from '@prisma/client';

/** Problem row with every relation the detail page needs. */
export type ProblemWithRelations = Problem & {
  tags: (ProblemTag & { tag: Tag })[];
  companies: (ProblemCompany & { company: Company })[];
  examples: ProblemExample[];
  constraints: ProblemConstraint[];
  hints: ProblemHint[];
  editorial: ProblemEditorial | null;
  testCases: TestCase[];
};

/** Lighter shape for list pages (no statement/testcases/editorial). */
export type ProblemListRow = Problem & {
  tags: (ProblemTag & { tag: Tag })[];
  companies: (ProblemCompany & { company: Company })[];
};

export const SORT_OPTIONS = ['newest', 'oldest', 'acceptance', 'difficulty'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface ProblemListFilters {
  difficulty?: Difficulty;
  tags?: string[]; // tag slugs
  companies?: string[]; // company slugs
  q?: string;
  solved?: boolean; // requires viewer
  bookmarked?: boolean; // requires viewer
}

export interface ProblemListOptions {
  page: number;
  pageSize: number;
  sortBy: SortOption;
  filters: ProblemListFilters;
  /** id of the authenticated viewer, if any — powers solved/bookmarked flags */
  viewerId?: string;
  /** which visibilities the viewer may see (computed from role) */
  visibleVisibilities: ProblemVisibility[];
}

export interface ProblemListResult {
  rows: ProblemListRow[];
  total: number;
  /** per-problem viewer flags, empty maps for guests */
  solvedIds: Set<string>;
  bookmarkedIds: Set<string>;
}

export interface TrendingRow {
  problemId: string;
  recentSubmissions: number;
}

export type ProblemSnapshot = Pick<
  Problem,
  'slug' | 'title' | 'statement' | 'difficulty' | 'visibility' | 'timeLimitMs' | 'memoryLimitMb'
> & {
  tags: string[];
  companies: string[];
  examples: { input: string; output: string; explanation: string | null; order: number }[];
  constraints: { description: string; order: number }[];
  hints: { content: string; order: number }[];
  editorial: {
    content: string;
    timeComplexity: string | null;
    spaceComplexity: string | null;
  } | null;
};

export type { ProblemVersion };
