import type { IContentModerator } from '../interfaces/ai.interfaces.js';

/**
 * Lightweight content moderation. A programming coach shouldn't process
 * or emit hateful/abusive content; this blocks the obvious cases on both
 * input and output. Deliberately conservative + fast (no extra API call)
 * so it stays cheap at 1M requests/month. A production deploy can swap in
 * a hosted moderation endpoint behind this same port.
 */
const BLOCKLIST: RegExp[] = [
  /\b(kill|harm)\s+(yourself|themselves)\b/i,
  /\bhate\s+(speech|crime)\b/i,
  // extend with org policy terms; kept minimal here on purpose
];

export class KeywordContentModerator implements IContentModerator {
  isAllowed(text: string): { allowed: boolean; reason?: string } {
    for (const re of BLOCKLIST) {
      if (re.test(text)) return { allowed: false, reason: 'policy_violation' };
    }
    return { allowed: true };
  }
}
