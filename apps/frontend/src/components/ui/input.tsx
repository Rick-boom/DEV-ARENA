import { forwardRef } from 'react';
import { cn } from '@/utils/cn.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * Input (atom). `invalid` drives both the visual state and aria-invalid
 * so the error is announced, not just coloured.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-lg px-3 text-sm',
        'bg-[var(--color-surface)] text-[var(--color-fg)]',
        'border border-[var(--color-border)]',
        'placeholder:text-[var(--color-fg-subtle)]',
        'transition-colors duration-150',
        'hover:border-[var(--color-border-strong)]',
        'focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-subtle)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid &&
          'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger-subtle)]',
        className,
      )}
      {...props}
    />
  );
});
