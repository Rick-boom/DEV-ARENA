import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { VerdictBadge } from '@/features/workspace/components/verdict-badge.js';
import { formatRelativeTime } from '@/utils/format.js';
import type { ActivityEntry, LeaderboardRow } from '@/types/problem.types.js';
import { Avatar } from '@/components/ui/avatar.js';

/** Recent activity — what the user did, newest first. */
export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[14px]">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pb-4">
        {entries.length === 0 ? (
          <p className="py-2 text-[13px] text-[var(--color-fg-muted)]">
            Solve a problem and it&apos;ll show up here.
          </p>
        ) : (
          entries.slice(0, 8).map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 text-[13px]">
              {entry.verdict ? <VerdictBadge verdict={entry.verdict} size="sm" /> : null}
              {entry.kind === 'rating' && entry.delta !== undefined ? (
                <span
                  className={
                    entry.delta >= 0
                      ? 'font-mono text-[11px] text-[var(--color-success)]'
                      : 'font-mono text-[11px] text-[var(--color-danger)]'
                  }
                >
                  {entry.delta >= 0 ? '+' : ''}
                  {entry.delta}
                </span>
              ) : null}
              {entry.problemId && entry.problemTitle ? (
                <Link
                  to={`/problems/${entry.problemId}`}
                  className="min-w-0 flex-1 truncate hover:text-[var(--color-accent)]"
                >
                  {entry.problemTitle}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[var(--color-fg-muted)]">
                  Rating updated
                </span>
              )}
              <span className="shrink-0 font-mono text-[10px] text-[var(--color-fg-subtle)]">
                {formatRelativeTime(entry.at)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** Top of the global board — a preview, not the full leaderboard. */
export function LeaderboardPreview({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[14px]">Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 pb-4">
        {rows.length === 0 ? (
          <p className="py-2 text-[13px] text-[var(--color-fg-muted)]">
            The board fills up as matches finish.
          </p>
        ) : (
          rows.slice(0, 5).map((row) => (
            <div key={row.userId} className="flex items-center gap-3 text-[13px]">
              <span className="w-5 shrink-0 font-mono text-[11px] text-[var(--color-fg-subtle)]">
                {row.rank}
              </span>
              <Avatar src={row.avatarUrl} name={row.username} size={22} />
              <span className="min-w-0 flex-1 truncate">{row.username}</span>
              <span className="shrink-0 font-mono text-[11px] text-[var(--color-accent)]">
                {row.rating}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
