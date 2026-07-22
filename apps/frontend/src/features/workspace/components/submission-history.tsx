import { Spinner } from '@/components/ui/spinner.js';
import { useGetSubmissionHistoryQuery } from '@/store/api/submission-api.js';
import { VerdictBadge } from './verdict-badge.js';
import { LANGUAGE_BY_ID } from '@/constants/editor.js';
import { formatMemory, formatRelativeTime, formatRuntime } from '@/utils/format.js';

/**
 * Past submissions for this problem. Read-only history — restoring old
 * code is a separate feature with its own confirmation, and silently
 * replacing the editor buffer from a list click would destroy work.
 */
export function SubmissionHistory({ problemId }: { problemId: string }) {
  const { data, isLoading, isError } = useGetSubmissionHistoryQuery({ problemId, limit: 20 });

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner label="Loading submissions" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="p-4 text-[13px] text-[var(--color-fg-muted)]">
        Couldn&apos;t load your submissions. They&apos;re safe — try again in a moment.
      </p>
    );
  }

  if (!data?.length) {
    return (
      <p className="p-6 text-center text-[13px] text-[var(--color-fg-muted)]">
        No submissions yet. Your attempts will appear here.
      </p>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-left">
        <caption className="sr-only">Your submissions for this problem</caption>
        <thead className="sticky top-0 bg-[var(--color-surface)]">
          <tr className="font-mono text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Language
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Runtime
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Memory
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              When
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((submission) => (
            <tr
              key={submission.id}
              className="border-t border-[var(--color-border)] text-[12px] hover:bg-[var(--color-elevated)]"
            >
              <td className="px-3 py-2">
                <VerdictBadge verdict={submission.status} size="sm" />
              </td>
              <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">
                {LANGUAGE_BY_ID.get(submission.language)?.label ?? submission.language}
              </td>
              <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">
                {formatRuntime(submission.runtimeMs)}
              </td>
              <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">
                {formatMemory(submission.memoryKb)}
              </td>
              <td className="px-3 py-2 text-[var(--color-fg-subtle)]">
                {formatRelativeTime(submission.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
