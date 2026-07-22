import { cn } from '@/utils/cn.js';

/**
 * Avatar (atom) with a deterministic initials fallback — the same user
 * always gets the same letters, and a missing image never leaves a hole
 * in the layout.
 */
export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full',
        'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]',
        'font-mono text-[11px] font-semibold select-none',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials || '?'}</span>
      )}
    </span>
  );
}
