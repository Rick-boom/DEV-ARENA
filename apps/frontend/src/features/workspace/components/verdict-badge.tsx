import { VERDICT_META } from './verdict-meta.js';
import type { Verdict } from '@/types/problem.types.js';
import { cn } from '@/utils/cn.js';

/**
 * Verdict label. Colour is never the only signal — the words carry the
 * meaning, and the tooltip carries the explanation.
 */
export function VerdictBadge({
  verdict,
  size = 'md',
  className,
}: {
  verdict: Verdict;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono font-semibold',
        size === 'sm' ? 'text-[11px]' : 'text-[13px]',
        meta.tone,
        className,
      )}
      title={meta.help}
    >
      {meta.label}
    </span>
  );
}
