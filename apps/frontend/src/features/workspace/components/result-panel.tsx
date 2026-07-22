import { motion } from 'framer-motion';
import { Clock, Cpu } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner.js';
import { Alert } from '@/components/ui/alert.js';
import { useAppSelector } from '@/store/hooks.js';
import { selectSubmissionState } from '@/store/selectors.js';
import { RunStatus } from '@/store/slices/submission-slice.js';
import { VERDICT_META } from './verdict-meta.js';
import { NotificationVariant } from '@/types/ui.types.js';
import { Verdict } from '@/types/problem.types.js';
import { formatMemory, formatRuntime } from '@/utils/format.js';
import { cn } from '@/utils/cn.js';

/**
 * The judged result of a submission.
 *
 * The failing case is surfaced first and explicitly — a verdict without
 * "which case, and what went wrong" is a scoreboard, not a tool. Hidden
 * cases show pass/fail and timing only; their inputs stay hidden, which
 * is the whole point of a hidden test.
 */
export function ResultPanel() {
  const { submitStatus, lastSubmission, submitError, activeSubmissionId } =
    useAppSelector(selectSubmissionState);

  if (submitStatus === RunStatus.RUNNING || activeSubmissionId) {
    return (
      <div className="grid h-full place-items-center gap-2">
        <Spinner label="Judging your submission" />
        <p className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
          judging against all test cases…
        </p>
      </div>
    );
  }

  if (submitStatus === RunStatus.FAILED) {
    return (
      <div className="p-3">
        <Alert variant={NotificationVariant.ERROR} title="Submission problem">
          {submitError ?? 'The judge did not respond.'}
        </Alert>
      </div>
    );
  }

  if (!lastSubmission) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <p className="text-[13px] text-[var(--color-fg-muted)]">
          Submit to run against every test case.
          <br />
          <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
            Ctrl/⌘ + Shift + Enter
          </span>
        </p>
      </div>
    );
  }

  const meta = VERDICT_META[lastSubmission.status];
  const accepted = lastSubmission.status === Verdict.ACCEPTED;
  const firstFailure = lastSubmission.results.find(
    (result) => result.status !== Verdict.ACCEPTED && result.status !== Verdict.SKIPPED,
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-3">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-1"
      >
        <h3 className={cn('font-mono text-lg font-semibold', meta.tone)}>{meta.label}</h3>
        <p className="text-[13px] text-[var(--color-fg-muted)]">{meta.help}</p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-[var(--color-fg-muted)]">
        <span>
          {lastSubmission.passed}/{lastSubmission.total} cases passed
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatRuntime(lastSubmission.runtimeMs)}
        </span>
        <span className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
          {formatMemory(lastSubmission.memoryKb)}
        </span>
      </div>

      {/* Progress bar doubles as an at-a-glance pass ratio. */}
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
        role="progressbar"
        aria-valuenow={lastSubmission.passed}
        aria-valuemin={0}
        aria-valuemax={lastSubmission.total}
        aria-label="Test cases passed"
      >
        <div
          className={cn(
            'h-full rounded-full',
            accepted ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]',
          )}
          style={{
            width: `${lastSubmission.total ? (lastSubmission.passed / lastSubmission.total) * 100 : 0}%`,
          }}
        />
      </div>

      {firstFailure ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
            First failing case
          </span>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-3">
            <p className="font-mono text-[12px]">
              Case {firstFailure.order + 1}
              {firstFailure.hidden ? ' (hidden)' : ''} —{' '}
              <span className={VERDICT_META[firstFailure.status].tone}>
                {VERDICT_META[firstFailure.status].label}
              </span>
            </p>
            {firstFailure.stderr ? (
              <pre className="mt-2 max-h-40 overflow-auto font-mono text-[11px] whitespace-pre-wrap text-[var(--color-danger)]">
                {firstFailure.stderr}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {lastSubmission.results.map((result) => (
          <span
            key={result.testCaseId}
            title={`Case ${result.order + 1}: ${VERDICT_META[result.status].label}`}
            className={cn(
              'h-6 w-6 rounded font-mono text-[10px] leading-6 text-center',
              result.status === Verdict.ACCEPTED
                ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                : result.status === Verdict.SKIPPED
                  ? 'bg-[var(--color-elevated)] text-[var(--color-fg-subtle)]'
                  : 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]',
            )}
          >
            {result.order + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
