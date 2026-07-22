import type { Difficulty, ProblemVisibility, TestCase } from '@prisma/client';
import type { ProblemListRow, ProblemWithRelations } from '../types/problem.types.js';

/**
 * Response DTOs + mappers — the ONLY doorway from database rows to
 * the wire. Central rule enforced here: hidden test cases and other
 * admin-only fields physically cannot leak, because the public
 * mappers never read them.
 */

export interface TagDto {
  name: string;
  slug: string;
}

export interface ProblemSummaryDto {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: TagDto[];
  companies: TagDto[];
  solvedCount: number;
  submissionCount: number;
  acceptanceRate: number; // 0..100, 1 decimal
  isSolved: boolean;
  isBookmarked: boolean;
  createdAt: string;
}

export interface ProblemDetailDto extends Omit<ProblemSummaryDto, 'isSolved' | 'isBookmarked'> {
  statement: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  examples: { input: string; output: string; explanation: string | null }[];
  constraints: string[];
  hints: string[];
  editorial: {
    content: string;
    timeComplexity: string | null;
    spaceComplexity: string | null;
  } | null;
  sampleTestCases: { input: string; expectedOutput: string }[];
  isSolved: boolean;
  isBookmarked: boolean;
}

/** Admin view adds moderation fields + ALL test cases incl. hidden. */
export interface AdminProblemDetailDto extends Omit<ProblemDetailDto, 'sampleTestCases'> {
  visibility: ProblemVisibility;
  version: number;
  authorId: string | null;
  deletedAt: string | null;
  testCases: {
    id: string;
    input: string;
    expectedOutput: string;
    isHidden: boolean;
    weight: number;
    order: number;
  }[];
}

export function acceptanceRate(solved: number, submissions: number): number {
  if (submissions === 0) return 0;
  return Math.round((solved / submissions) * 1000) / 10;
}

export function toProblemSummaryDto(
  row: ProblemListRow,
  viewer: { solvedIds: Set<string>; bookmarkedIds: Set<string> },
): ProblemSummaryDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    tags: row.tags.map((t) => ({ name: t.tag.name, slug: t.tag.slug })),
    companies: row.companies.map((c) => ({ name: c.company.name, slug: c.company.slug })),
    solvedCount: row.solvedCount,
    submissionCount: row.submissionCount,
    acceptanceRate: acceptanceRate(row.solvedCount, row.submissionCount),
    isSolved: viewer.solvedIds.has(row.id),
    isBookmarked: viewer.bookmarkedIds.has(row.id),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toProblemDetailDto(
  problem: ProblemWithRelations,
  viewer: { isSolved: boolean; isBookmarked: boolean },
): ProblemDetailDto {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    statement: problem.statement,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    tags: problem.tags.map((t) => ({ name: t.tag.name, slug: t.tag.slug })),
    companies: problem.companies.map((c) => ({ name: c.company.name, slug: c.company.slug })),
    examples: [...problem.examples]
      .sort((a, b) => a.order - b.order)
      .map((e) => ({ input: e.input, output: e.output, explanation: e.explanation })),
    constraints: [...problem.constraints]
      .sort((a, b) => a.order - b.order)
      .map((c) => c.description),
    hints: [...problem.hints].sort((a, b) => a.order - b.order).map((h) => h.content),
    editorial: problem.editorial
      ? {
          content: problem.editorial.content,
          timeComplexity: problem.editorial.timeComplexity,
          spaceComplexity: problem.editorial.spaceComplexity,
        }
      : null,
    // SECURITY: only non-hidden cases ever cross this boundary.
    sampleTestCases: problem.testCases
      .filter((tc) => !tc.isHidden)
      .sort((a, b) => a.order - b.order)
      .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
    solvedCount: problem.solvedCount,
    submissionCount: problem.submissionCount,
    acceptanceRate: acceptanceRate(problem.solvedCount, problem.submissionCount),
    isSolved: viewer.isSolved,
    isBookmarked: viewer.isBookmarked,
    createdAt: problem.createdAt.toISOString(),
  };
}

export function toAdminProblemDetailDto(problem: ProblemWithRelations): AdminProblemDetailDto {
  const base = toProblemDetailDto(problem, { isSolved: false, isBookmarked: false });
  const { sampleTestCases: _discard, ...rest } = base;
  return {
    ...rest,
    visibility: problem.visibility,
    version: problem.version,
    authorId: problem.authorId,
    deletedAt: problem.deletedAt ? problem.deletedAt.toISOString() : null,
    testCases: [...problem.testCases]
      .sort((a, b) => a.order - b.order)
      .map((tc: TestCase) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        weight: tc.weight,
        order: tc.order,
      })),
  };
}
