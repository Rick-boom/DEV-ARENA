import { cn } from '@/utils/cn.js';

/**
 * Skeleton (atom). Used for content that will occupy a known shape, so
 * the layout doesn't jump when data lands.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-[var(--color-elevated)]', className)}
      {...props}
    />
  );
}
