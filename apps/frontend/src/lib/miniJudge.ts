/**
 * Client-side mini-judge for the demo arena. The user's JavaScript
 * runs inside a dedicated Web Worker (no DOM, no app scope) against a
 * fixed test set; the main thread enforces a hard timeout and
 * terminates the worker — the same isolation story as the real
 * Docker judge, scaled down to a browser tab.
 */

export interface JudgeTest {
  nums: number[];
  target: number;
}

export interface TestResult {
  index: number;
  pass: boolean;
  ms: number;
}

export type JudgeVerdict = 'AC' | 'WA' | 'RE' | 'TLE';

export interface JudgeOutcome {
  verdict: JudgeVerdict;
  results: TestResult[];
  error?: string;
}

export const ARENA_TESTS: JudgeTest[] = [
  { nums: [2, 7, 11, 15], target: 9 },
  { nums: [3, 2, 4], target: 6 },
  { nums: [3, 3], target: 6 },
  { nums: [-1, -2, -3, -4, -5], target: -8 },
  { nums: [0, 4, 3, 0], target: 0 },
  { nums: [1, 5, 9, 13, 17, 21], target: 30 },
  { nums: [5, 75, 25], target: 100 },
  { nums: Array.from({ length: 4000 }, (_, i) => i * 2 + 1), target: 7997 },
];

const WORKER_SOURCE = `
self.onmessage = (e) => {
  const { code, tests } = e.data;
  let fn;
  try {
    fn = new Function(code + '\\n;return twoSum;')();
    if (typeof fn !== 'function') throw new Error('Define a function named twoSum');
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
    return;
  }
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const start = performance.now();
    let out;
    try {
      out = fn(t.nums.slice(), t.target);
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err && err.message ? err.message : err), index: i });
      return;
    }
    const ms = performance.now() - start;
    const ok =
      Array.isArray(out) &&
      out.length === 2 &&
      Number.isInteger(out[0]) &&
      Number.isInteger(out[1]) &&
      out[0] !== out[1] &&
      t.nums[out[0]] + t.nums[out[1]] === t.target;
    self.postMessage({ type: 'test', index: i, pass: ok, ms: Math.round(ms * 10) / 10 });
    if (!ok) {
      self.postMessage({ type: 'done', verdict: 'WA' });
      return;
    }
  }
  self.postMessage({ type: 'done', verdict: 'AC' });
};
`;

export function runJudge(
  code: string,
  onTest: (result: TestResult) => void,
  timeoutMs = 2500,
): Promise<JudgeOutcome> {
  return new Promise((resolve) => {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const results: TestResult[] = [];
    let settled = false;

    const finish = (outcome: JudgeOutcome) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(outcome);
    };

    const killer = window.setTimeout(() => finish({ verdict: 'TLE', results }), timeoutMs);

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { type: 'test'; index: number; pass: boolean; ms: number }
        | { type: 'done'; verdict: 'AC' | 'WA' }
        | { type: 'error'; message: string };
      if (msg.type === 'test') {
        const r: TestResult = { index: msg.index, pass: msg.pass, ms: msg.ms };
        results.push(r);
        onTest(r);
      } else if (msg.type === 'done') {
        window.clearTimeout(killer);
        finish({ verdict: msg.verdict, results });
      } else {
        window.clearTimeout(killer);
        finish({ verdict: 'RE', results, error: msg.message });
      }
    };
    worker.onerror = () => {
      window.clearTimeout(killer);
      finish({ verdict: 'RE', results, error: 'Worker crashed' });
    };

    worker.postMessage({ code, tests: ARENA_TESTS });
  });
}
