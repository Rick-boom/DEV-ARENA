import { Bookmark, Building2, Lightbulb, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectWorkspace } from '@/store/selectors.js';
import { ProblemTab, hintRevealed, problemTabChanged } from '@/store/slices/workspace-slice.js';
import { useToggleBookmarkMutation } from '@/store/api/problem-api.js';
import { SubmissionHistory } from './submission-history.js';
import { DIFFICULTY_META } from '@/constants/problems.js';
import { formatPercent } from '@/utils/format.js';
import { cn } from '@/utils/cn.js';
import type { ProblemDetail } from '@/types/problem.types.js';

const TABS: { id: ProblemTab; label: string }[] = [
  { id: ProblemTab.DESCRIPTION, label: 'Description' },
  { id: ProblemTab.EDITORIAL, label: 'Editorial' },
  { id: ProblemTab.SUBMISSIONS, label: 'Submissions' },
];

/**
 * The left half of the workspace: everything about the problem.
 *
 * Hints reveal one at a time and stay behind an explicit click. A hint
 * you didn't ask for isn't a hint, and showing them all at once removes
 * the ladder that makes them useful.
 *
 * The editorial is gated behind the same idea — it's the answer, so it
 * takes a deliberate action to open.
 */
export function ProblemPanel({ problem }: { problem: ProblemDetail }) {
  const dispatch = useAppDispatch();
  const { problemTab, revealedHints } = useAppSelector(selectWorkspace);
  const [toggleBookmark] = useToggleBookmarkMutation();

  const onTabKeyDown = (event: React.KeyboardEvent, index: number): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : (index - 1 + TABS.length) % TABS.length;
    dispatch(problemTabChanged(TABS[next]!.id));
  };

  return (
    <section
      aria-label="Problem"
      className="flex h-full min-h-0 flex-col bg-[var(--color-surface)]"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--color-border)] px-2 py-1">
        <div role="tablist" aria-label="Problem panels" className="flex gap-1">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              id={`problem-tab-${tab.id}`}
              aria-selected={problemTab === tab.id}
              aria-controls={`problem-panel-${tab.id}`}
              tabIndex={problemTab === tab.id ? 0 : -1}
              onClick={() => dispatch(problemTabChanged(tab.id))}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] transition-colors',
                problemTab === tab.id
                  ? 'bg-[var(--color-elevated)] text-[var(--color-fg)]'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={cn('ml-auto h-7 w-7', problem.bookmarked && 'text-[var(--color-accent)]')}
          onClick={() =>
            void toggleBookmark({ problemId: problem.id, bookmarked: problem.bookmarked })
          }
          aria-label={problem.bookmarked ? 'Remove bookmark' : 'Bookmark this problem'}
          aria-pressed={problem.bookmarked}
        >
          <Bookmark className={cn('h-4 w-4', problem.bookmarked && 'fill-current')} />
        </Button>
      </div>

      <div
        role="tabpanel"
        id={`problem-panel-${problemTab}`}
        aria-labelledby={`problem-tab-${problemTab}`}
        className="min-h-0 flex-1 overflow-auto"
      >
        {problemTab === ProblemTab.DESCRIPTION ? (
          <Description
            problem={problem}
            revealedHints={revealedHints}
            onReveal={(id) => dispatch(hintRevealed(id))}
          />
        ) : null}
        {problemTab === ProblemTab.EDITORIAL ? <Editorial problem={problem} /> : null}
        {problemTab === ProblemTab.SUBMISSIONS ? (
          <SubmissionHistory problemId={problem.id} />
        ) : null}
      </div>
    </section>
  );
}

function Description({
  problem,
  revealedHints,
  onReveal,
}: {
  problem: ProblemDetail;
  revealedHints: string[];
  onReveal: (id: string) => void;
}) {
  const difficulty = DIFFICULTY_META[problem.difficulty];

  return (
    <div className="flex flex-col gap-6 p-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{problem.title}</h1>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          <span className={difficulty.className}>{difficulty.label}</span>
          <span className="text-[var(--color-fg-subtle)]">
            {formatPercent(problem.acceptedRate)} accepted
          </span>
          <span className="text-[var(--color-fg-subtle)]">
            {problem.totalSubmissions.toLocaleString()} submissions
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {problem.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
          {problem.companies.map((company) => (
            <Badge key={company} variant="accent">
              <Building2 className="h-3 w-3" aria-hidden="true" />
              {company}
            </Badge>
          ))}
        </div>
      </header>

      {/* Server-authored statement; rendered as preformatted text rather
          than dangerouslySetInnerHTML — untrusted markup in an editor
          surface is not a risk worth taking for formatting. */}
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-[var(--color-fg)]">
        {problem.statement}
      </p>

      {problem.examples.length ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
            Examples
          </h2>
          {problem.examples.map((example, index) => (
            <div
              key={example.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-3"
            >
              <p className="mb-2 font-mono text-[11px] text-[var(--color-fg-subtle)]">
                Example {index + 1}
              </p>
              <dl className="flex flex-col gap-1.5 font-mono text-[12px]">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-[var(--color-fg-subtle)]">Input:</dt>
                  <dd className="whitespace-pre-wrap">{example.input}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-[var(--color-fg-subtle)]">Output:</dt>
                  <dd className="whitespace-pre-wrap">{example.output}</dd>
                </div>
              </dl>
              {example.explanation ? (
                <p className="mt-2 text-[12px] text-[var(--color-fg-muted)]">
                  {example.explanation}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {problem.constraints.length ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-[11px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
            Constraints
          </h2>
          <ul className="flex flex-col gap-1">
            {problem.constraints.map((constraint) => (
              <li key={constraint} className="font-mono text-[12px] text-[var(--color-fg-muted)]">
                • {constraint}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {problem.hints.length ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-[11px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
            Hints
          </h2>
          {problem.hints.map((hint, index) => {
            const revealed = revealedHints.includes(hint.id);
            return revealed ? (
              <div
                key={hint.id}
                className="flex gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-3 text-[13px] text-[var(--color-fg-muted)]"
              >
                <Lightbulb
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]"
                  aria-hidden="true"
                />
                {hint.content}
              </div>
            ) : (
              <Button
                key={hint.id}
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={() => onReveal(hint.id)}
              >
                <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                Show hint {index + 1}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Editorial({ problem }: { problem: ProblemDetail }) {
  if (!problem.editorial) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <Lock className="h-5 w-5 text-[var(--color-fg-subtle)]" aria-hidden="true" />
          <p className="text-[13px] text-[var(--color-fg-muted)]">
            The editorial unlocks once you&apos;ve solved this problem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap gap-2">
        {problem.editorial.timeComplexity ? (
          <Badge variant="accent">time {problem.editorial.timeComplexity}</Badge>
        ) : null}
        {problem.editorial.spaceComplexity ? (
          <Badge variant="accent">space {problem.editorial.spaceComplexity}</Badge>
        ) : null}
      </div>
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-[var(--color-fg)]">
        {problem.editorial.content}
      </p>
    </div>
  );
}
