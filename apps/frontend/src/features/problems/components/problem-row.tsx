import { memo } from 'react';
import { Link } from 'react-router';
import { Bookmark, CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { useToggleBookmarkMutation } from '@/store/api/problem-api.js';
import { DIFFICULTY_META } from '@/constants/problems.js';
import { formatPercent } from '@/utils/format.js';
import { cn } from '@/utils/cn.js';
import type { ProblemSummary } from '@/types/problem.types.js';

/**
 * One explorer row.
 *
 * Memoized because the list re-renders on every filter keystroke and a
 * row's props only change when that specific problem does — without it,
 * typing in the search box re-renders every visible row.
 */
export const ProblemRow = memo(function ProblemRow({ problem }: { problem: ProblemSummary }) {
  const [toggleBookmark] = useToggleBookmarkMutation();
  const difficulty = DIFFICULTY_META[problem.difficulty];

  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 transition-colors hover:bg-[var(--color-elevated)]">
      <span className="w-5 shrink-0" aria-hidden={!problem.solved}>
        {problem.solved ? <CircleCheck className="h-4 w-4 text-[var(--color-success)]" /> : null}
        {problem.solved ? <span className="sr-only">Solved</span> : null}
      </span>

      <div className="min-w-0 flex-1">
        <Link
          to={`/problems/${problem.slug}`}
          className="truncate text-[14px] font-medium text-[var(--color-fg)] hover:text-[var(--color-accent)]"
        >
          {problem.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {problem.tags.slice(0, 3).map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
          {problem.tags.length > 3 ? (
            <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
              +{problem.tags.length - 3}
            </span>
          ) : null}
        </div>
      </div>

      <span className={cn('w-16 shrink-0 text-right font-mono text-[11px]', difficulty.className)}>
        {difficulty.label}
      </span>

      <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] text-[var(--color-fg-subtle)] sm:block">
        {formatPercent(problem.acceptedRate)}
      </span>

      <button
        type="button"
        onClick={() =>
          void toggleBookmark({ problemId: problem.id, bookmarked: problem.bookmarked })
        }
        aria-label={
          problem.bookmarked ? `Remove bookmark from ${problem.title}` : `Bookmark ${problem.title}`
        }
        aria-pressed={problem.bookmarked}
        className={cn(
          'shrink-0 rounded p-1 transition-colors',
          problem.bookmarked
            ? 'text-[var(--color-accent)]'
            : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]',
        )}
      >
        <Bookmark className={cn('h-4 w-4', problem.bookmarked && 'fill-current')} />
      </button>
    </div>
  );
});
