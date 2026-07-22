import { JUDGE_CONSTANTS } from '../constants/judge.constants.js';
import { OutputComparator } from '../comparators/output-comparator.js';
import type {
  ComparatorKind,
  ExecutionOutcome,
  JudgeTestCase,
  Verdict,
} from '../types/judge.types.js';

/**
 * Maps a raw execution outcome + expected output into ONE test-case
 * verdict. Order matters: infrastructure failures (timeout, OOM, crash)
 * are decided BEFORE we ever compare output, because a program that
 * crashed has no meaningful stdout to check. The precedence here is the
 * judge's contract with users — a TLE must never be reported as WA.
 */
export class VerdictMapper {
  constructor(private readonly comparator = new OutputComparator()) {}

  map(outcome: ExecutionOutcome, testCase: JudgeTestCase, comparator: ComparatorKind): Verdict {
    // 1. Compilation failure is a whole-submission concern, but if it
    //    surfaces per-run we honor it first.
    if (outcome.compileError) return 'COMPILATION_ERROR';
    // 2. Resource limits — decided before output.
    if (outcome.timedOut) return 'TIME_LIMIT_EXCEEDED';
    if (outcome.oomKilled) return 'MEMORY_LIMIT_EXCEEDED';
    if (outcome.truncated) return 'OUTPUT_LIMIT_EXCEEDED';
    // 3. Runtime crash (non-zero exit / signal).
    if (outcome.exitCode !== 0 && outcome.exitCode !== null) return 'RUNTIME_ERROR';
    if (outcome.exitCode === null) return 'RUNTIME_ERROR';
    // 4. Only now is output meaningful → compare.
    const cmp = this.comparator.compare(comparator, testCase.expectedOutput, outcome.stdout);
    if (cmp.match) return cmp.presentationError ? 'PRESENTATION_ERROR' : 'ACCEPTED';
    return 'WRONG_ANSWER';
  }

  /** Bytes of stdout, for the output-limit pre-check the engine may miss. */
  exceedsOutputLimit(stdout: string): boolean {
    return Buffer.byteLength(stdout, 'utf8') > JUDGE_CONSTANTS.EXECUTION.OUTPUT_LIMIT_BYTES;
  }
}
