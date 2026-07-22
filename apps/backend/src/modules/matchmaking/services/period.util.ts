/**
 * Period bucket keys. Weekly/monthly leaderboards are separate ZSETs
 * keyed by ISO week / calendar month, so "this week's board" is just a
 * different key — no time-filtering at read time, and old boards expire
 * naturally by never being read (or via a housekeeping TTL).
 */
export function currentPeriods(now = new Date()): { weekly: string; monthly: string } {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return { weekly: `${year}-W${isoWeek(now)}`, monthly: `${year}-${month}` };
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return String(week).padStart(2, '0');
}
