/**
 * Display formatters. Centralised so a runtime reads the same way in the
 * output panel, the submissions table and the history list — differing
 * formats for the same quantity make a UI feel assembled rather than
 * designed.
 */
export function formatRuntime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatMemory(kb: number | null | undefined): string {
  if (kb === null || kb === undefined) return '—';
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Relative time for activity feeds — "3h ago" beats a raw timestamp. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
