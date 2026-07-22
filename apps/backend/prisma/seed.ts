/**
 * DevArena — Database Seed
 *
 * Idempotent by design: every write is an upsert keyed on a natural
 * unique (email, slug, code, name), so `pnpm db:seed` can run any
 * number of times — locally, in CI, or against a fresh environment —
 * without duplicating rows.
 *
 * Seeds: admin, demo users, tags, achievements, and three fully
 * populated problems (examples, constraints, hints, editorial,
 * visible + hidden test cases).
 *
 * Run: pnpm --filter @devarena/backend db:seed
 */
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient, Difficulty, ProblemVisibility, AchievementType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * scrypt hash in `scrypt$<salt>$<hash>` format. The auth service
 * (next milestone) owns the real hashing policy; seed passwords only
 * need to be non-plaintext and verifiable. Demo password: Devarena!123
 */
function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

// ─────────────────────────── USERS ─────────────────────────────────

async function seedUsers() {
  const users = [
    {
      username: 'admin',
      email: 'admin@devarena.dev',
      role: 'ADMIN' as const,
      rating: 2400,
      bio: 'Platform administrator',
    },
    {
      username: 'rick_dev',
      email: 'rick@devarena.dev',
      role: 'USER' as const,
      rating: 1450,
      bio: 'MERN developer. Battle me.',
    },
    {
      username: 'sourav_codes',
      email: 'sourav@devarena.dev',
      role: 'USER' as const,
      rating: 1380,
      bio: 'Backend enjoyer.',
    },
    {
      username: 'anshu_ml',
      email: 'anshu@devarena.dev',
      role: 'PREMIUM' as const,
      rating: 1520,
      bio: 'DP or nothing.',
    },
  ];

  const results = [];
  for (const u of users) {
    results.push(
      await prisma.user.upsert({
        where: { email: u.email },
        update: { role: u.role, bio: u.bio },
        create: {
          username: u.username,
          email: u.email,
          passwordHash: hashPassword('Devarena!123'),
          role: u.role,
          rating: u.rating,
          bio: u.bio,
          isVerified: true,
          country: 'IN',
        },
      }),
    );
  }
  console.log(`✔ users: ${results.length}`);
  return Object.fromEntries(results.map((u) => [u.username, u]));
}

// ─────────────────────────── TAGS ──────────────────────────────────

async function seedTags() {
  const names = [
    'Array',
    'String',
    'Hash Table',
    'Two Pointers',
    'Dynamic Programming',
    'Binary Search',
    'Stack',
    'Graph',
  ];
  const tags = [];
  for (const name of names) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    tags.push(
      await prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { name, slug },
      }),
    );
  }
  console.log(`✔ tags: ${tags.length}`);
  return Object.fromEntries(tags.map((t) => [t.slug, t]));
}

// ──────────────────────── ACHIEVEMENTS ─────────────────────────────

async function seedAchievements() {
  const achievements = [
    {
      code: 'FIRST_BLOOD',
      name: 'First Blood',
      description: 'Solve your first problem.',
      type: AchievementType.SOLVE_COUNT,
      threshold: 1,
    },
    {
      code: 'PROBLEM_CRUSHER_50',
      name: 'Problem Crusher',
      description: 'Solve 50 problems.',
      type: AchievementType.SOLVE_COUNT,
      threshold: 50,
    },
    {
      code: 'WEEK_STREAK',
      name: 'Consistency',
      description: 'Stay active 7 days in a row.',
      type: AchievementType.STREAK,
      threshold: 7,
    },
    {
      code: 'GLADIATOR_10',
      name: 'Gladiator',
      description: 'Win 10 battles.',
      type: AchievementType.BATTLE_WINS,
      threshold: 10,
    },
    {
      code: 'RATING_1600',
      name: 'Expert',
      description: 'Reach a rating of 1600.',
      type: AchievementType.RATING,
      threshold: 1600,
    },
  ];

  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { code: a.code },
      update: { name: a.name, description: a.description, threshold: a.threshold },
      create: a,
    });
  }
  console.log(`✔ achievements: ${achievements.length}`);
}

// ────────────────────────── PROBLEMS ───────────────────────────────

interface SeedProblem {
  slug: string;
  title: string;
  statement: string;
  difficulty: Difficulty;
  tags: string[];
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  hints: string[];
  editorial: { content: string; timeComplexity: string; spaceComplexity: string };
  testCases: { input: string; expectedOutput: string; isHidden: boolean }[];
}

const problems: SeedProblem[] = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: Difficulty.EASY,
    tags: ['array', 'hash-table'],
    statement: [
      'Given an array of integers `nums` and an integer `target`, return the **indices** of the two numbers that add up to `target`.',
      '',
      'Exactly one valid answer exists, and you may not use the same element twice. Return the indices in ascending order.',
    ].join('\n'),
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'nums[0] + nums[1] = 2 + 7 = 9.',
      },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    constraints: [
      '2 <= nums.length <= 10^5',
      '-10^9 <= nums[i] <= 10^9',
      'Exactly one valid answer exists.',
    ],
    hints: [
      'A brute force pairs check is O(n²). Can you trade memory for time?',
      'While scanning, ask: have I already seen target - nums[i]?',
    ],
    editorial: {
      content:
        'Scan once, keeping a hash map from value → index. For each element x, if target − x is already in the map, the answer is [map[target − x], i]. Otherwise store x. One pass, one lookup per element.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    testCases: [
      { input: '4\n2 7 11 15\n9', expectedOutput: '0 1', isHidden: false },
      { input: '3\n3 2 4\n6', expectedOutput: '1 2', isHidden: false },
      { input: '2\n-5 5\n0', expectedOutput: '0 1', isHidden: true },
      { input: '5\n1 2 3 4 1000000000\n1000000004', expectedOutput: '3 4', isHidden: true },
    ],
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: Difficulty.EASY,
    tags: ['string', 'stack'],
    statement: [
      'Given a string `s` containing only the characters `()[]{}`, determine whether it is **valid**.',
      '',
      'A string is valid when every opening bracket is closed by the same type of bracket and brackets close in the correct order.',
    ].join('\n'),
    examples: [
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false', explanation: 'A `(` cannot be closed by `]`.' },
    ],
    constraints: ['1 <= s.length <= 10^4', 's consists only of ()[]{}'],
    hints: [
      'The most recently opened bracket must be the first one closed. Which data structure gives you that order?',
      'Push openers; on a closer, the stack top must be its matching opener.',
    ],
    editorial: {
      content:
        'Use a stack. Push every opening bracket. On a closing bracket, the stack must be non-empty and its top must be the matching opener — pop it, otherwise the string is invalid. Valid iff the stack ends empty.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    testCases: [
      { input: '()[]{}', expectedOutput: 'true', isHidden: false },
      { input: '(]', expectedOutput: 'false', isHidden: false },
      { input: '([{}])', expectedOutput: 'true', isHidden: true },
      { input: '(((', expectedOutput: 'false', isHidden: true },
    ],
  },
  {
    slug: 'longest-increasing-subsequence',
    title: 'Longest Increasing Subsequence',
    difficulty: Difficulty.MEDIUM,
    tags: ['dynamic-programming', 'binary-search', 'array'],
    statement: [
      'Given an integer array `nums`, return the length of the longest **strictly increasing** subsequence.',
      '',
      'A subsequence keeps relative order but need not be contiguous.',
    ].join('\n'),
    examples: [
      {
        input: 'nums = [10,9,2,5,3,7,101,18]',
        output: '4',
        explanation: 'One LIS is [2,3,7,101].',
      },
      { input: 'nums = [7,7,7,7]', output: '1' },
    ],
    constraints: ['1 <= nums.length <= 2500', '-10^4 <= nums[i] <= 10^4'],
    hints: [
      'Classic DP: dp[i] = LIS ending exactly at i. What is the transition?',
      'O(n²) DP passes here — but patience sorting with binary search gives O(n log n). Keep tails[k] = smallest tail of an increasing subsequence of length k+1.',
    ],
    editorial: {
      content:
        'Maintain an array `tails` where tails[k] is the smallest possible tail of an increasing subsequence of length k+1. For each x, binary-search the first tails element ≥ x and replace it (or append if none). tails stays sorted; its length is the answer.',
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(n)',
    },
    testCases: [
      { input: '8\n10 9 2 5 3 7 101 18', expectedOutput: '4', isHidden: false },
      { input: '4\n7 7 7 7', expectedOutput: '1', isHidden: false },
      { input: '1\n-5', expectedOutput: '1', isHidden: true },
      { input: '6\n1 3 6 7 9 4', expectedOutput: '5', isHidden: true },
    ],
  },
];

async function seedProblems(adminId: string, tagsBySlug: Record<string, { id: string }>) {
  for (const p of problems) {
    const problem = await prisma.problem.upsert({
      where: { slug: p.slug },
      update: { title: p.title, statement: p.statement, difficulty: p.difficulty },
      create: {
        slug: p.slug,
        title: p.title,
        statement: p.statement,
        difficulty: p.difficulty,
        visibility: ProblemVisibility.PUBLIC,
        authorId: adminId,
      },
    });

    // Children are wiped and rewritten inside one transaction — for
    // seed data this is simpler and safer than diffing, and the
    // cascade rules make the deletes cheap and consistent.
    await prisma.$transaction([
      prisma.problemTag.deleteMany({ where: { problemId: problem.id } }),
      prisma.problemExample.deleteMany({ where: { problemId: problem.id } }),
      prisma.problemConstraint.deleteMany({ where: { problemId: problem.id } }),
      prisma.problemHint.deleteMany({ where: { problemId: problem.id } }),
      prisma.testCase.deleteMany({ where: { problemId: problem.id } }),

      prisma.problemTag.createMany({
        data: p.tags.map((slug) => {
          const tag = tagsBySlug[slug];
          if (!tag) throw new Error(`Seed bug: unknown tag slug "${slug}"`);
          return { problemId: problem.id, tagId: tag.id };
        }),
      }),
      prisma.problemExample.createMany({
        data: p.examples.map((e, i) => ({
          problemId: problem.id,
          input: e.input,
          output: e.output,
          explanation: e.explanation ?? null,
          order: i,
        })),
      }),
      prisma.problemConstraint.createMany({
        data: p.constraints.map((description, i) => ({
          problemId: problem.id,
          description,
          order: i,
        })),
      }),
      prisma.problemHint.createMany({
        data: p.hints.map((content, i) => ({ problemId: problem.id, content, order: i })),
      }),
      prisma.testCase.createMany({
        data: p.testCases.map((t, i) => ({
          problemId: problem.id,
          input: t.input,
          expectedOutput: t.expectedOutput,
          isHidden: t.isHidden,
          order: i,
        })),
      }),
      prisma.problemEditorial.upsert({
        where: { problemId: problem.id },
        update: { content: p.editorial.content },
        create: {
          problemId: problem.id,
          content: p.editorial.content,
          timeComplexity: p.editorial.timeComplexity,
          spaceComplexity: p.editorial.spaceComplexity,
        },
      }),
    ]);
  }
  console.log(
    `✔ problems: ${problems.length} (with examples, constraints, hints, editorial, tests)`,
  );
}

// ─────────────────────────── MAIN ──────────────────────────────────

async function main() {
  console.log('▶ Seeding DevArena database');
  const users = await seedUsers();
  const tags = await seedTags();
  await seedAchievements();
  const admin = users['admin'];
  if (!admin) throw new Error('Seed bug: admin user missing');
  await seedProblems(admin.id, tags);
  console.log('✔ Seed complete. Demo login password for all users: Devarena!123');
  // sha256 exported use-site: keeps the helper compiled & documented
  // for the auth milestone which stores sha256(refreshToken).
  void sha256;
}

main()
  .catch((e) => {
    console.error('✖ Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
