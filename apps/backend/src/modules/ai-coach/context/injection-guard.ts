/**
 * Prompt-injection detection for untrusted user free-text (the follow-up
 * "question" field). We don't try to be perfect — we flag the common
 * override patterns ("ignore previous instructions", "reveal the
 * solution/editorial", role-switching) and reject them. Combined with
 * the system prompt's refusal rule and the response validator, this is
 * defense in depth: three independent layers must all fail to leak.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|prompts)/i,
  /disregard\s+(the\s+)?(system|previous|above)/i,
  /you\s+are\s+now\s+(a|an|the)\b/i,
  /\bact\s+as\b.*\b(unrestricted|jailbroken|dan)\b/i,
  /reveal\s+(the\s+)?(solution|editorial|answer|hidden\s+tests?)/i,
  /(print|output|give|show)\s+(me\s+)?(the\s+)?(full|complete|entire)\s+(solution|answer|code)/i,
  /system\s*prompt/i,
  /\bprompt\s+injection\b/i,
];

export function detectInjection(text: string): { injected: boolean; matched?: string } {
  for (const re of INJECTION_PATTERNS) {
    if (re.test(text)) return { injected: true, matched: re.source };
  }
  return { injected: false };
}
