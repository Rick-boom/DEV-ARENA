/** Central knobs for the Problem module — one place to tune, no magic numbers in logic. */
export const PROBLEM_CONSTANTS = {
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },
  LIMITS: {
    MAX_TAGS_PER_PROBLEM: 10,
    MAX_COMPANIES_PER_PROBLEM: 15,
    MAX_HINTS: 10,
    MAX_EXAMPLES: 10,
    MAX_TEST_CASES_PER_UPLOAD: 200,
    MAX_STDERR_LENGTH: 2000,
  },
  TRENDING: {
    WINDOW_DAYS: 7,
    SIZE: 20,
  },
  RECENTLY_SOLVED_SIZE: 20,
  CACHE: {
    TTL_DETAIL_SECONDS: 60,
    TTL_TRENDING_SECONDS: 300,
    TTL_TAXONOMY_SECONDS: 600,
    KEYS: {
      detailById: (id: string) => `problems:detail:id:${id}`,
      detailBySlug: (slug: string) => `problems:detail:slug:${slug}`,
      trending: 'problems:trending',
      tags: 'problems:tags',
      companies: 'problems:companies',
    },
  },
} as const;
