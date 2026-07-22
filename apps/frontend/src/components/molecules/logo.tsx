import { cn } from '@/utils/cn.js';
import { APP } from '@/constants/app.js';

/**
 * Logo (molecule). The mark is two offset brackets — the shape of a
 * head-to-head match rendered in the vernacular of code. Drawn as SVG so
 * it stays crisp and inherits currentColor across both themes.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 text-[var(--color-accent)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6 4 12l5 6" />
        <path d="m15 6 5 6-5 6" />
      </svg>
      {showWordmark ? (
        <span className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
          {APP.NAME}
        </span>
      ) : null}
      <span className="sr-only">{APP.NAME}</span>
    </span>
  );
}
