/**
 * Mock rows shaped exactly like the backend's ProblemSummaryDto, so
 * swapping in React Query + /api/v1/problems later is a one-line
 * change per field, not a refactor.
 */
export interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  tags: string[];
  companies: string[];
  acceptanceRate: number;
  solvedCount: number;
  isSolved: boolean;
}

export const PROBLEMS: ProblemRow[] = [
  {
    id: '1',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'EASY',
    tags: ['array', 'hash-table'],
    companies: ['google', 'amazon'],
    acceptanceRate: 52.4,
    solvedCount: 18432,
    isSolved: true,
  },
  {
    id: '2',
    slug: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'MEDIUM',
    tags: ['array', 'sorting'],
    companies: ['meta'],
    acceptanceRate: 46.1,
    solvedCount: 9310,
    isSolved: true,
  },
  {
    id: '3',
    slug: 'lru-cache',
    title: 'LRU Cache',
    difficulty: 'MEDIUM',
    tags: ['design', 'hash-table'],
    companies: ['amazon', 'uber'],
    acceptanceRate: 41.8,
    solvedCount: 8054,
    isSolved: false,
  },
  {
    id: '4',
    slug: 'word-ladder',
    title: 'Word Ladder',
    difficulty: 'HARD',
    tags: ['bfs', 'graph'],
    companies: ['google'],
    acceptanceRate: 38.9,
    solvedCount: 4120,
    isSolved: false,
  },
  {
    id: '5',
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'HARD',
    tags: ['two-pointers', 'stack'],
    companies: ['google', 'goldman'],
    acceptanceRate: 35.2,
    solvedCount: 5233,
    isSolved: false,
  },
  {
    id: '6',
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'EASY',
    tags: ['stack', 'string'],
    companies: ['microsoft'],
    acceptanceRate: 61.7,
    solvedCount: 15980,
    isSolved: true,
  },
  {
    id: '7',
    slug: 'course-schedule',
    title: 'Course Schedule',
    difficulty: 'MEDIUM',
    tags: ['graph', 'topological-sort'],
    companies: ['netflix'],
    acceptanceRate: 44.3,
    solvedCount: 6871,
    isSolved: false,
  },
  {
    id: '8',
    slug: 'median-of-two-sorted-arrays',
    title: 'Median of Two Sorted Arrays',
    difficulty: 'HARD',
    tags: ['binary-search', 'divide-and-conquer'],
    companies: ['apple', 'google'],
    acceptanceRate: 29.6,
    solvedCount: 3542,
    isSolved: false,
  },
  {
    id: '9',
    slug: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'EASY',
    tags: ['array', 'dp'],
    companies: ['amazon'],
    acceptanceRate: 57.9,
    solvedCount: 14211,
    isSolved: false,
  },
  {
    id: '10',
    slug: 'longest-palindromic-substring',
    title: 'Longest Palindromic Substring',
    difficulty: 'MEDIUM',
    tags: ['string', 'dp'],
    companies: ['amazon', 'microsoft'],
    acceptanceRate: 40.5,
    solvedCount: 7690,
    isSolved: false,
  },
];

export const DIFFICULTY_COLOR: Record<ProblemRow['difficulty'], string> = {
  EASY: 'var(--color-green)',
  MEDIUM: 'var(--color-gold)',
  HARD: 'var(--color-red)',
};
