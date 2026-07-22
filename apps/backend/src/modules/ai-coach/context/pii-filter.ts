/**
 * Strips likely PII from user-supplied text before it reaches the model
 * or the logs. Coding submissions occasionally contain a stray email,
 * key, or token in a comment; we redact those so we never forward
 * personal data to a third-party API or persist it in prompt logs.
 */
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'email', re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'phone', re: /(?<!\d)(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g },
  { name: 'apikey', re: /\b(?:sk|pk|api|key|token|secret)[-_]?[a-zA-Z0-9]{16,}\b/gi },
  { name: 'jwt', re: /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g },
  { name: 'creditcard', re: /\b(?:\d[ -]*?){13,16}\b/g },
];

export function redactPII(text: string): { redacted: string; found: string[] } {
  let redacted = text;
  const found: string[] = [];
  for (const { name, re } of PATTERNS) {
    if (re.test(redacted)) {
      found.push(name);
      redacted = redacted.replace(re, `[REDACTED_${name.toUpperCase()}]`);
    }
  }
  return { redacted, found };
}
