/**
 * Deterministic per-user color. Cursor/selection colors must be STABLE
 * across sessions and IDENTICAL on every peer (so everyone sees "Alice =
 * teal"), which rules out random assignment. We hash the userId into a
 * fixed palette — same id ⇒ same color everywhere, no coordination.
 */
const PALETTE = [
  '#30bced',
  '#6eeb83',
  '#ffbc42',
  '#ecd444',
  '#ee6352',
  '#9ac2c9',
  '#8acb88',
  '#f5a3c7',
  '#c17ffb',
  '#54c6ab',
  '#ff8c42',
  '#4d9de0',
  '#e15554',
  '#3bb273',
  '#7768ae',
] as const;

export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

/** Semi-transparent variant for selection highlights. */
export function selectionColor(hex: string): string {
  return `${hex}33`; // 20% alpha
}
