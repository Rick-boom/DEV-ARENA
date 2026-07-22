import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn.js';

/**
 * Badge (atom). Set in the MONO face by default: badges carry statuses,
 * ratings, and verdicts — data, not prose — and the mono face signals
 * that at a glance. This is the one place the utility face earns its keep.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium tracking-tight',
  {
    variants: {
      variant: {
        neutral:
          'bg-[var(--color-surface)] text-[var(--color-fg-muted)] border border-[var(--color-border)]',
        accent: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]',
        success: 'bg-[var(--color-success)]/12 text-[var(--color-success)]',
        danger: 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]',
        warning: 'bg-[var(--color-warning)]/12 text-[var(--color-warning)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
