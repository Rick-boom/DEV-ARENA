import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import { DIFFICULTY_META } from '@/constants/problems.js';
import { formatPercent } from '@/utils/format.js';
import { cn } from '@/utils/cn.js';
import type { ProblemSummary } from '@/types/problem.types.js';

/**
 * One card wrapping a short list of problems. Recent / trending /
 * recommended are the same shape, so they share this component rather
 * than three near-identical ones — the only thing that differs is the
 * heading and the empty-state sentence.
 */
export function ProblemCardList({
  title,
  problems,
  emptyMessage,
  isLoading,
  icon,
}: {
  title: string;
  problems: ProblemSummary[];
  emptyMessage: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[14px]">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-1 pb-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))
        ) : problems.length === 0 ? (
          <p className="py-2 text-[13px] text-[var(--color-fg-muted)]">{emptyMessage}</p>
        ) : (
          problems.map((problem) => (
            <Link
              key={problem.id}
              to={`/problems/${problem.slug}`}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-surface)]"
            >
              <span className="min-w-0 flex-1 truncate text-[13px]">{problem.title}</span>
              <span
                className={cn(
                  'shrink-0 font-mono text-[10px]',
                  DIFFICULTY_META[problem.difficulty].className,
                )}
              >
                {DIFFICULTY_META[problem.difficulty].label}
              </span>
              <span className="hidden shrink-0 font-mono text-[10px] text-[var(--color-fg-subtle)] sm:block">
                {formatPercent(problem.acceptedRate)}
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
