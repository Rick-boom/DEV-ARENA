import { forwardRef } from 'react';
import { cn } from '@/utils/cn.js';

/**
 * Checkbox (atom). A styled native input rather than a div-with-role:
 * the native control gets keyboard support, form participation, and
 * screen-reader semantics for free.
 */
export const Checkbox = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--color-border-strong)]',
          'bg-[var(--color-surface)] accent-[var(--color-accent)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
          className,
        )}
        {...props}
      />
    );
  },
);
