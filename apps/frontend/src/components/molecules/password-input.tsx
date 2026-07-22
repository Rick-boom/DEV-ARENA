import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input.js';
import { cn } from '@/utils/cn.js';
import { scorePassword } from '@/utils/password-strength.js';

/**
 * PasswordInput (molecule). The reveal toggle is a real button with an
 * aria-label that flips with state, so a screen-reader user knows both
 * what it does and what the current state is.
 */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className={cn(
          'absolute top-1/2 right-2 -translate-y-1/2 rounded p-1',
          'text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]',
        )}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

/**
 * Strength meter. Deliberately advisory, not gatekeeping — the real rule
 * is the Zod schema. It scores length and character variety and tells
 * the user what would improve it, because "weak" alone isn't actionable.
 */
export function PasswordStrength({ value }: { value: string }) {
  const { score, advice } = scorePassword(value);
  if (!value) return null;

  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent'] as const;
  const tones = [
    'bg-[var(--color-danger)]',
    'bg-[var(--color-danger)]',
    'bg-[var(--color-warning)]',
    'bg-[var(--color-success)]',
    'bg-[var(--color-success)]',
  ] as const;

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              i < score ? tones[score] : 'bg-[var(--color-border)]',
            )}
          />
        ))}
      </div>
      <p className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
        {labels[score]}
        {advice ? ` — ${advice}` : ''}
      </p>
    </div>
  );
}
