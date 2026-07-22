import { Card, CardContent } from '@/components/ui/card.js';
import { DIFFICULTY_META } from '@/constants/problems.js';
import { Difficulty } from '@/types/problem.types.js';
import { cn } from '@/utils/cn.js';
import type { DashboardSummary } from '@/types/problem.types.js';

/**
 * Solve progress by difficulty.
 *
 * Bars rather than a single percentage: "142 solved" hides whether
 * someone has done 140 easy problems or 40 hard ones, and that
 * distinction is the whole point of tracking difficulty.
 */
export function ProgressCard({ summary }: { summary: DashboardSummary }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold tracking-tight">
            {summary.solvedCount}
          </span>
          <span className="text-[13px] text-[var(--color-fg-muted)]">problems solved</span>
          {summary.streakDays > 0 ? (
            <span className="ml-auto font-mono text-[11px] text-[var(--color-warning)]">
              {summary.streakDays}-day streak
            </span>
          ) : null}
        </div>

        <dl className="flex flex-col gap-2.5">
          {Object.values(Difficulty).map((difficulty) => {
            const stat = summary.byDifficulty[difficulty];
            const percent = stat.total ? (stat.solved / stat.total) * 100 : 0;
            const meta = DIFFICULTY_META[difficulty];
            return (
              <div key={difficulty} className="flex items-center gap-3">
                <dt className={cn('w-14 shrink-0 font-mono text-[11px]', meta.className)}>
                  {meta.label}
                </dt>
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]"
                  role="progressbar"
                  aria-valuenow={stat.solved}
                  aria-valuemin={0}
                  aria-valuemax={stat.total}
                  aria-label={`${meta.label} problems solved`}
                >
                  <div
                    className="h-full rounded-full bg-current transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <dd className="w-16 shrink-0 text-right font-mono text-[11px] text-[var(--color-fg-subtle)]">
                  {stat.solved}/{stat.total}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
