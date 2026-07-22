/**
 * Minimal debounce for high-frequency awareness updates (cursor moves).
 * Broadcasting every mousemove/keystroke would flood the socket; we
 * coalesce them into at most one update per interval — the single
 * biggest bandwidth win for cursor sync at 100+ editors.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): ((...args: A) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const debounced = (...args: A): void => {
    lastArgs = args;
    if (timer) return; // leading-throttle: fire at most once per window
    timer = setTimeout(() => {
      if (lastArgs) fn(...lastArgs);
      timer = null;
      lastArgs = null;
    }, waitMs);
  };
  debounced.cancel = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  return debounced;
}
