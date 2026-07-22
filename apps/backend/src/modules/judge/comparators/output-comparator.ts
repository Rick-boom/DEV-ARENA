import { JUDGE_CONSTANTS } from '../constants/judge.constants.js';
import { ComparatorKind } from '../types/judge.types.js';

/**
 * Output comparison — the correctness core of any online judge. A naive
 * string-equals check produces false WRONG_ANSWERs on trailing
 * whitespace or float rounding, so the judge supports several strategies
 * and can distinguish a genuinely WRONG answer from a mere PRESENTATION
 * error (right tokens, wrong spacing) — the way Codeforces/ICPC do.
 */
export interface CompareResult {
  match: boolean;
  /** true when tokens match but exact byte layout differs */
  presentationError: boolean;
}

export class OutputComparator {
  compare(kind: ComparatorKind, expected: string, actual: string): CompareResult {
    switch (kind) {
      case ComparatorKind.EXACT:
        return this.exact(expected, actual);
      case ComparatorKind.FLOAT:
        return this.float(expected, actual);
      case ComparatorKind.TOKEN:
      case ComparatorKind.CUSTOM: // CUSTOM falls back to token here; a real
      default: //                   special-judge would plug in via a port
        return this.token(expected, actual);
    }
  }

  /** Byte-for-byte, after stripping a single trailing newline. */
  private exact(expected: string, actual: string): CompareResult {
    const e = expected.replace(/\r\n/g, '\n').replace(/\n$/, '');
    const a = actual.replace(/\r\n/g, '\n').replace(/\n$/, '');
    return { match: e === a, presentationError: false };
  }

  /**
   * Whitespace-normalized token compare (the sensible default). Splits on
   * any whitespace and compares token sequences. If tokens match but the
   * raw layout differed, it's a PRESENTATION error, not WRONG_ANSWER.
   */
  private token(expected: string, actual: string): CompareResult {
    const te = this.tokenize(expected);
    const ta = this.tokenize(actual);
    const tokensMatch = te.length === ta.length && te.every((t, i) => t === ta[i]);
    if (!tokensMatch) return { match: false, presentationError: false };
    const exactMatch =
      expected.replace(/\r\n/g, '\n').replace(/\s+$/, '') ===
      actual.replace(/\r\n/g, '\n').replace(/\s+$/, '');
    return { match: true, presentationError: !exactMatch };
  }

  /**
   * Numeric compare with absolute-or-relative tolerance, so
   * 0.1+0.2 == 0.3 doesn't fail. Non-numeric tokens must still match
   * exactly (mixed text/number outputs are handled).
   */
  private float(expected: string, actual: string): CompareResult {
    const te = this.tokenize(expected);
    const ta = this.tokenize(actual);
    if (te.length !== ta.length) return { match: false, presentationError: false };
    const eps = JUDGE_CONSTANTS.COMPARE.FLOAT_EPSILON;
    for (let i = 0; i < te.length; i += 1) {
      const en = Number(te[i]);
      const an = Number(ta[i]);
      if (Number.isNaN(en) || Number.isNaN(an)) {
        if (te[i] !== ta[i]) return { match: false, presentationError: false };
        continue;
      }
      const diff = Math.abs(en - an);
      const rel = diff / Math.max(1, Math.abs(en));
      if (diff > eps && rel > eps) return { match: false, presentationError: false };
    }
    return { match: true, presentationError: false };
  }

  private tokenize(s: string): string[] {
    return s.trim().split(/\s+/).filter(Boolean);
  }
}
