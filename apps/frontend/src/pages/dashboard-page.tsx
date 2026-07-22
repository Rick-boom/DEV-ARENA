import { Link } from 'react-router';
import { ArrowRight, Flame, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Alert } from '@/components/ui/alert.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import { ProblemCardList } from '@/features/dashboard/components/problem-card-list.js';
import { ProgressCard } from '@/features/dashboard/components/progress-card.js';
import { ActivityFeed, LeaderboardPreview } from '@/features/dashboard/components/activity-feed.js';
import { useGetDashboardQuery } from '@/store/api/problem-api.js';
import { useAppSelector } from '@/store/hooks.js';
import { selectUser } from '@/store/selectors.js';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { DIFFICULTY_META } from '@/constants/problems.js';
import { ROUTES } from '@/constants/routes.js';
import { NotificationVariant } from '@/types/ui.types.js';

/**
 * Dashboard: what to do next, then how you're doing.
 *
 * "Continue solving" is the hero because the most common reason to open
 * this page is to resume something — putting stats first would make the
 * user scroll past their own history to get back to work.
 */
export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const user = useAppSelector(selectUser);
  const { data, isLoading, isError, refetch } = useGetDashboardQuery();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-fg-subtle)] uppercase">
          Dashboard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user?.displayName ?? user?.username ?? 'coder'}
        </h1>
      </header>

      {isError ? (
        <Alert variant={NotificationVariant.ERROR} title="Couldn't load your dashboard">
          <button
            type="button"
            onClick={() => void refetch()}
            className="underline underline-offset-4"
          >
            Try again
          </button>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Continue + daily challenge */}
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : data?.continueProblem ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
                    Continue solving
                  </p>
                  <p className="mt-1.5 truncate text-[16px] font-medium">
                    {data.continueProblem.title}
                  </p>
                  <p
                    className={`mt-1 font-mono text-[11px] ${DIFFICULTY_META[data.continueProblem.difficulty].className}`}
                  >
                    {DIFFICULTY_META[data.continueProblem.difficulty].label}
                  </p>
                </div>
                <Button asChild>
                  <Link to={`/problems/${data.continueProblem.slug}`}>
                    Resume
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">Start your first problem</p>
                  <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
                    Pick something easy and get a solve on the board.
                  </p>
                </div>
                <Button asChild>
                  <Link to={ROUTES.PROBLEMS}>Browse problems</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {data?.dailyChallenge ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-[var(--color-warning)]" aria-hidden="true" />
                    <p className="font-mono text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
                      Daily challenge
                    </p>
                  </div>
                  <p className="mt-1.5 truncate text-[15px] font-medium">
                    {data.dailyChallenge.title}
                  </p>
                </div>
                <Badge variant="warning">today</Badge>
                <Button variant="secondary" asChild>
                  <Link to={`/problems/${data.dailyChallenge.slug}`}>Solve</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isLoading ? (
            <Skeleton className="h-44 w-full rounded-xl" />
          ) : data ? (
            <ProgressCard summary={data} />
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          {data ? <LeaderboardPreview rows={data.leaderboard} /> : null}
          {data ? <ActivityFeed entries={data.activity} /> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ProblemCardList
          title="Recommended"
          icon={<Sparkles className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />}
          problems={data?.recommended ?? []}
          isLoading={isLoading}
          emptyMessage="Solve a few problems and we'll suggest what to try next."
        />
        <ProblemCardList
          title="Trending"
          icon={<TrendingUp className="h-4 w-4 text-[var(--color-info)]" aria-hidden="true" />}
          problems={data?.trending ?? []}
          isLoading={isLoading}
          emptyMessage="Nothing trending right now."
        />
        <ProblemCardList
          title="Recent"
          problems={data?.recent ?? []}
          isLoading={isLoading}
          emptyMessage="Problems you open will appear here."
        />
      </div>
    </div>
  );
}
