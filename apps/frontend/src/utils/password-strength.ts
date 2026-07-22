/**
 * Password strength scoring. Lives apart from the component because it's
 * pure logic — independently testable, and reusable anywhere a strength
 * hint is needed. Advisory only: the enforced rule is the Zod schema.
 */
export function scorePassword(value: string): { score: 0 | 1 | 2 | 3 | 4; advice: string } {
  if (value.length < 8) return { score: 0, advice: 'use at least 8 characters' };
  let score = 1;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  if (value.length >= 12) score += 1;
  if (variety >= 3) score += 1;
  if (variety === 4 && value.length >= 16) score += 1;

  const missing: string[] = [];
  if (!hasUpper) missing.push('a capital');
  if (!hasDigit) missing.push('a number');
  if (!hasSymbol) missing.push('a symbol');

  return {
    score: Math.min(score, 4) as 0 | 1 | 2 | 3 | 4,
    advice: missing.length && score < 3 ? `add ${missing.slice(0, 2).join(' and ')}` : '',
  };
}
