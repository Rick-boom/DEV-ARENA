import { Verdict } from '@/types/problem.types.js';

/**
 * Verdict presentation in one table.
 *
 * Every verdict gets a short label AND a full explanation, because
 * "MLE" means nothing to a beginner while "Memory Limit Exceeded" plus
 * "your solution used more memory than allowed" is actionable. Colour is
 * never the only signal — the text carries the meaning on its own.
 */
export const VERDICT_META: Record<
  Verdict,
  { short: string; label: string; help: string; tone: string }
> = {
  [Verdict.ACCEPTED]: {
    short: 'AC',
    label: 'Accepted',
    help: 'All test cases passed.',
    tone: 'text-[var(--color-success)]',
  },
  [Verdict.WRONG_ANSWER]: {
    short: 'WA',
    label: 'Wrong Answer',
    help: 'Your output did not match the expected output.',
    tone: 'text-[var(--color-danger)]',
  },
  [Verdict.TIME_LIMIT_EXCEEDED]: {
    short: 'TLE',
    label: 'Time Limit Exceeded',
    help: 'Your solution ran longer than the problem allows. Look for a faster approach.',
    tone: 'text-[var(--color-warning)]',
  },
  [Verdict.MEMORY_LIMIT_EXCEEDED]: {
    short: 'MLE',
    label: 'Memory Limit Exceeded',
    help: 'Your solution used more memory than allowed.',
    tone: 'text-[var(--color-warning)]',
  },
  [Verdict.RUNTIME_ERROR]: {
    short: 'RE',
    label: 'Runtime Error',
    help: 'Your program crashed while running. Check the error output.',
    tone: 'text-[var(--color-danger)]',
  },
  [Verdict.COMPILATION_ERROR]: {
    short: 'CE',
    label: 'Compilation Error',
    help: 'Your code did not compile. Check the compiler output.',
    tone: 'text-[var(--color-danger)]',
  },
  [Verdict.OUTPUT_LIMIT_EXCEEDED]: {
    short: 'OLE',
    label: 'Output Limit Exceeded',
    help: 'Your program printed far more output than expected.',
    tone: 'text-[var(--color-warning)]',
  },
  [Verdict.PRESENTATION_ERROR]: {
    short: 'PE',
    label: 'Presentation Error',
    help: 'The values are right but the formatting differs — check spacing and line breaks.',
    tone: 'text-[var(--color-warning)]',
  },
  [Verdict.SKIPPED]: {
    short: 'SK',
    label: 'Skipped',
    help: 'This case was not run because an earlier one failed.',
    tone: 'text-[var(--color-fg-subtle)]',
  },
  [Verdict.INTERNAL_ERROR]: {
    short: 'ERR',
    label: 'Internal Error',
    help: 'Something went wrong on our side. This is not your fault — try submitting again.',
    tone: 'text-[var(--color-danger)]',
  },
  [Verdict.PENDING]: {
    short: '…',
    label: 'Pending',
    help: 'Waiting for a judge.',
    tone: 'text-[var(--color-fg-muted)]',
  },
  [Verdict.QUEUED]: {
    short: '…',
    label: 'Queued',
    help: 'Waiting for a judge.',
    tone: 'text-[var(--color-fg-muted)]',
  },
  [Verdict.RUNNING]: {
    short: '▸',
    label: 'Running',
    help: 'Your submission is being judged.',
    tone: 'text-[var(--color-info)]',
  },
};
