import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn.js';

/**
 * Spinner (atom). role="status" + a visually-hidden label so screen
 * readers announce the wait instead of encountering silence.
 */
export function Spinner({
  className,
  label = 'Loading',
  size = 'md',
}: {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimensions = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }[size];
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <Loader2
        className={cn('animate-spin text-[var(--color-fg-muted)]', dimensions)}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
