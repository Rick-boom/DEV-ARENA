import { useId } from 'react';
import { cn } from '@/utils/cn.js';
import { Label } from '@/components/ui/label.js';

/**
 * FormField (molecule) — the accessibility contract for every input in
 * the app, in one place: a real <label> bound by id, the error wired via
 * aria-describedby + aria-invalid, and hint text that doesn't disappear
 * when an error appears. Fields render this instead of re-deriving the
 * wiring and getting it subtly wrong each time.
 *
 * Uses a render prop so it stays agnostic about the control it wraps.
 */
export function FormField({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="ml-0.5 text-[var(--color-danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-[var(--color-fg-subtle)]">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
