import { AiMode, type CoachContext, type CoachResponse } from '../types/ai.types.js';
import { createModuleLogger } from '../../../lib/logger.js';

const log = createModuleLogger('ai-response-validator');

/**
 * The last line of defense — this runs on the MODEL'S OUTPUT, after the
 * system prompt and injection guard. Its job: guarantee that no full
 * solution, editorial, or hidden test case escapes, and that the shape
 * is valid. Because we don't trust the model to always obey the prompt,
 * we mechanically enforce the rules here.
 *
 * Checks:
 *  • parse + coerce to the CoachResponse shape (drop unknown fields),
 *  • reject/scrub responses that echo the editorial or hidden inputs,
 *  • cap the amount of code in the output (a coach nudges; it doesn't
 *    paste a working solution),
 *  • bound length.
 */
export class ResponseValidator {
  parseAndValidate(raw: string, mode: AiMode, ctx: CoachContext): CoachResponse {
    const parsed = this.safeParse(raw);

    let summary = String(parsed.summary ?? '').trim();
    let points = Array.isArray(parsed.points) ? parsed.points.map((p) => String(p)) : [];

    // 1. Leak checks against grounding data we deliberately withheld.
    const leakHaystack = [summary, ...points, JSON.stringify(parsed.complexity ?? {})].join('\n');
    if (this.leaksEditorial(leakHaystack, ctx) || this.leaksHiddenTests(leakHaystack, ctx)) {
      log.warn({ problemId: ctx.problem.problemId, mode }, 'response leak detected — scrubbing');
      summary = 'Here is a hint to guide you without giving away the answer.';
      points = ['Re-read the constraints and think about which data structure fits.'];
    }

    // 2. Full-solution heuristic: too much code = likely the answer.
    const codeChars = this.codeCharCount(leakHaystack);
    if (codeChars > 400) {
      log.warn(
        { problemId: ctx.problem.problemId, codeChars },
        'excessive code in output — trimming',
      );
      points = points.map((p) => this.stripLargeCode(p));
      summary = this.stripLargeCode(summary);
    }

    // 3. Length bound.
    summary = summary.slice(0, 1200);
    points = points.slice(0, 8).map((p) => p.slice(0, 500));

    const response: CoachResponse = {
      mode,
      summary: summary || 'Let me help you think through this problem.',
      points,
      meta: { cached: false, model: '', latencyMs: 0 },
    };

    // 4. Mode-specific optional fields, coerced.
    if (mode === AiMode.COMPLEXITY && parsed.complexity && typeof parsed.complexity === 'object') {
      const c = parsed.complexity as Record<string, unknown>;
      response.complexity = {
        time: String(c.time ?? 'unknown'),
        space: String(c.space ?? 'unknown'),
        explanation: String(c.explanation ?? '').slice(0, 600),
      };
    }
    if (mode === AiMode.INTERVIEW && Array.isArray(parsed.questions)) {
      response.questions = parsed.questions.map((q) => String(q).slice(0, 300)).slice(0, 6);
    }
    if (
      (mode === AiMode.LEARNING || mode === AiMode.RECOMMENDATION) &&
      Array.isArray(parsed.recommendations)
    ) {
      response.recommendations = parsed.recommendations
        .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
        .map((r) => ({
          title: String(r.title ?? '').slice(0, 200),
          reason: String(r.reason ?? '').slice(0, 300),
          topic: r.topic ? String(r.topic) : undefined,
          problemId: r.problemId ? String(r.problemId) : undefined,
        }))
        .slice(0, 8);
    }
    if (mode === AiMode.HINT && typeof parsed.hintLevel === 'number') {
      response.hintLevel = parsed.hintLevel;
    }
    return response;
  }

  private safeParse(raw: string): Record<string, unknown> {
    try {
      // Strip only a LEADING/TRAILING markdown fence the model may have
      // wrapped the JSON in — not fences that appear inside string values.
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const obj = JSON.parse(cleaned) as unknown;
      return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>) : {};
    } catch {
      // Model returned prose; wrap it as a summary rather than failing.
      return { summary: raw.slice(0, 800), points: [] };
    }
  }

  /** Does the output echo the withheld editorial? (fuzzy substring on long spans) */
  private leaksEditorial(text: string, ctx: CoachContext): boolean {
    const editorial = ctx.problem.editorialText;
    if (!editorial || editorial.length < 40) return false;
    const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ');
    const ed = norm(editorial);
    const out = norm(text);
    // Flag if any 12-word window of the editorial appears verbatim in output.
    const words = ed.split(' ');
    for (let i = 0; i + 12 <= words.length; i += 6) {
      if (out.includes(words.slice(i, i + 12).join(' '))) return true;
    }
    return false;
  }

  private leaksHiddenTests(text: string, ctx: CoachContext): boolean {
    const inputs = ctx.problem.hiddenTestInputs ?? [];
    return inputs.some((inp) => inp.length >= 8 && text.includes(inp));
  }

  private codeCharCount(text: string): number {
    const blocks = text.match(/```[\s\S]*?```/g) ?? [];
    return blocks.reduce((sum, b) => sum + b.length, 0);
  }

  private stripLargeCode(text: string): string {
    return text.replace(/```[\s\S]*?```/g, '[code omitted — try implementing this yourself]');
  }
}
