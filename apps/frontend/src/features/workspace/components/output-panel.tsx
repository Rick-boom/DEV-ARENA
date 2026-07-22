import { Clock, Cpu } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner.js';
import { Alert } from '@/components/ui/alert.js';
import { useAppSelector } from '@/store/hooks.js';
import { selectSubmissionState } from '@/store/selectors.js';
import { RunStatus } from '@/store/slices/submission-slice.js';
import { NotificationVariant } from '@/types/ui.types.js';
import { formatMemory, formatRuntime } from '@/utils/format.js';

/**
 * Output of the last Run: stdout, stderr, and the resource readings.
 *
 * stderr is shown in its own block rather than merged into stdout —
 * conflating them is how people lose ten minutes to a stack trace that
 * scrolled past. Compile errors get top billing because nothing else
 * matters until the code builds.
 */
export function OutputPanel() {
  const { runStatus, runResult, runError } = useAppSelector(selectSubmissionState);

  if (runStatus === RunStatus.RUNNING) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner label="Running your code" />
      </div>
    );
  }

  if (runStatus === RunStatus.FAILED) {
    return (
      <div className="p-3">
        <Alert variant={NotificationVariant.ERROR} title="Couldn't run your code">
          {runError ?? 'The execution service did not respond.'}
        </Alert>
      </div>
    );
  }

  if (!runResult) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <p className="text-[13px] text-[var(--color-fg-muted)]">
          Run your code to see its output here.
          <br />
          <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
            Ctrl/⌘ + Enter
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-[var(--color-fg-muted)]">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatRuntime(runResult.runtimeMs)}
        </span>
        <span className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
          {formatMemory(runResult.memoryKb)}
        </span>
        <span>exit {runResult.exitCode ?? 'signal'}</span>
        {runResult.timedOut ? <span className="text-[var(--color-warning)]">timed out</span> : null}
      </div>

      {runResult.compileError ? (
        <Block label="Compiler" tone="danger" value={runResult.compileError} />
      ) : null}

      <Block label="stdout" value={runResult.stdout || '(no output)'} />

      {runResult.stderr ? <Block label="stderr" tone="danger" value={runResult.stderr} /> : null}
    </div>
  );
}

function Block({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
        {label}
      </span>
      <pre
        className={[
          'max-h-64 overflow-auto rounded-lg border p-3 font-mono text-[12px] whitespace-pre-wrap',
          tone === 'danger'
            ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
            : 'border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-fg)]',
        ].join(' ')}
      >
        {value}
      </pre>
    </div>
  );
}
