import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn.js';
import { NotificationVariant } from '@/types/ui.types.js';

const ICONS = {
  [NotificationVariant.SUCCESS]: CheckCircle2,
  [NotificationVariant.ERROR]: XCircle,
  [NotificationVariant.WARNING]: AlertTriangle,
  [NotificationVariant.INFO]: Info,
} as const;

const TONES = {
  [NotificationVariant.SUCCESS]: 'border-[var(--color-success)]/30 text-[var(--color-success)]',
  [NotificationVariant.ERROR]: 'border-[var(--color-danger)]/35 text-[var(--color-danger)]',
  [NotificationVariant.WARNING]: 'border-[var(--color-warning)]/30 text-[var(--color-warning)]',
  [NotificationVariant.INFO]: 'border-[var(--color-info)]/30 text-[var(--color-info)]',
} as const;

/**
 * Alert (atom) — inline, in-flow messaging (form errors, page notices).
 * `role="alert"` makes failures interrupt a screen reader; neutral info
 * uses the polite "status" role instead so it doesn't hijack focus.
 */
export function Alert({
  variant = NotificationVariant.INFO,
  title,
  children,
  className,
}: {
  variant?: NotificationVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = ICONS[variant];
  const isUrgent = variant === NotificationVariant.ERROR || variant === NotificationVariant.WARNING;
  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-lg border bg-[var(--color-surface)] px-4 py-3',
        TONES[variant],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-medium">{title}</p> : null}
        {children ? <div className="text-sm text-[var(--color-fg-muted)]">{children}</div> : null}
      </div>
    </div>
  );
}
