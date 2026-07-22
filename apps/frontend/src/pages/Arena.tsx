import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Link } from 'react-router';
import { Nav } from '../components/Nav';
import { runJudge, ARENA_TESTS, type JudgeVerdict, type TestResult } from '../lib/miniJudge';

/**
 * The playable demo: a real 1v1 against a scripted opponent.
 * Left — the sealed problem. Center — Monaco, wired to the in-browser
 * judge (Web Worker + hard timeout). Right — the opponent typing live.
 * First ACCEPTED wins the match and takes the Elo.
 */

const STARTER = `// Return indices of the two numbers that add up to target.
function twoSum(nums, target) {
  // your move.
}
`;

const OPPONENT_CODE = `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i`;

// Opponent gets a WA at 55s, recovers, ACs at 115s. Beat that.
const OPPONENT_WA_AT = 55_000;
const OPPONENT_AC_AT = 115_000;
const MATCH_SECONDS = 300;

type MatchResult = 'win' | 'loss' | null;

export function Arena() {
  const [secondsLeft, setSecondsLeft] = useState(MATCH_SECONDS);
  const [pips, setPips] = useState<TestResult[]>([]);
  const [verdict, setVerdict] = useState<JudgeVerdict | 'running' | null>(null);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [opponentTyped, setOpponentTyped] = useState(0);
  const [opponentStatus, setOpponentStatus] = useState<'typing' | 'WA' | 'AC'>('typing');
  const [result, setResult] = useState<MatchResult>(null);
  const codeRef = useRef(STARTER);
  const resultRef = useRef<MatchResult>(null);
  resultRef.current = result;

  // ── match clock ─────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(
      () => setSecondsLeft((s) => (resultRef.current ? s : Math.max(0, s - 1))),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  // ── opponent script ─────────────────────────────────────────────
  useEffect(() => {
    const timers: number[] = [];
    for (let i = 1; i <= OPPONENT_CODE.length; i += 1) {
      timers.push(window.setTimeout(() => setOpponentTyped(i), 800 + i * 210));
    }
    timers.push(
      window.setTimeout(() => {
        if (!resultRef.current) setOpponentStatus('WA');
      }, OPPONENT_WA_AT),
    );
    timers.push(
      window.setTimeout(() => {
        if (!resultRef.current) setOpponentStatus('typing');
      }, OPPONENT_WA_AT + 2600),
    );
    timers.push(
      window.setTimeout(() => {
        if (!resultRef.current) {
          setOpponentStatus('AC');
          setResult('loss');
        }
      }, OPPONENT_AC_AT),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // ── judge ───────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (verdict === 'running' || result) return;
    setPips([]);
    setJudgeError(null);
    setVerdict('running');
    const outcome = await runJudge(codeRef.current, (t) => setPips((p) => [...p, t]));
    setVerdict(outcome.verdict);
    setJudgeError(outcome.error ?? null);
    if (outcome.verdict === 'AC') setResult('win');
  }, [verdict, result]);

  const onMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme('devarena', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8d89a5', fontStyle: 'italic' },
        { token: 'keyword', foreground: '5ee6ff' },
        { token: 'number', foreground: 'ffc24b' },
        { token: 'string', foreground: 'ff5d73' },
      ],
      colors: {
        'editor.background': '#14121f',
        'editor.lineHighlightBackground': '#1a1730',
        'editorLineNumber.foreground': '#3a3560',
        'editorCursor.foreground': '#5ee6ff',
      },
    });
    monaco.editor.setTheme('devarena');
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void submit());
  };

  const clock = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [secondsLeft]);

  return (
    <div className="flex min-h-full flex-col">
      <Nav />

      {/* match bar */}
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2.5 font-mono text-xs">
          <span className="text-muted">
            BATTLE <span className="text-fg">#48213</span> · two-sum · EASY · rated
          </span>
          <span
            className="text-base font-semibold tabular-nums"
            style={{ color: secondsLeft < 60 ? 'var(--color-red)' : 'var(--color-fg)' }}
          >
            {clock}
          </span>
          <span className="flex items-center gap-2 text-muted">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-red" /> LIVE
          </span>
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-px bg-line lg:grid-cols-[1fr_1.5fr_1fr]">
        {/* ── problem panel ── */}
        <section className="bg-ink p-6">
          <p className="font-mono text-xs tracking-[0.2em] text-muted">SEALED PROBLEM</p>
          <h1 className="mt-2 font-display text-xl font-bold">Two Sum</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Given an array of integers <code className="font-mono text-fg">nums</code> and an
            integer <code className="font-mono text-fg">target</code>, return the indices of the two
            numbers that add up to <code className="font-mono text-fg">target</code>. Exactly one
            answer exists; don&apos;t use the same element twice.
          </p>
          <div className="mt-6 space-y-3">
            {ARENA_TESTS.slice(0, 2).map((t, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-panel p-3 font-mono text-[11px]"
              >
                <p className="text-muted">
                  input: nums = [{t.nums.join(', ')}], target = {t.target}
                </p>
              </div>
            ))}
            <p className="font-mono text-[11px] text-muted">
              + {ARENA_TESTS.length - 2} hidden test cases
            </p>
          </div>
          <div className="mt-8 rounded-lg border border-line bg-panel p-4">
            <p className="font-mono text-[11px]" style={{ color: 'var(--color-cyan)' }}>
              AI COACH · hint 1/3
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              For each number, you already know exactly what its partner must be. Where could you
              have seen it before?
            </p>
          </div>
        </section>

        {/* ── editor panel ── */}
        <section className="flex flex-col bg-panel">
          <div className="flex items-center justify-between px-4 py-2 font-mono text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: 'var(--color-cyan)' }}
              />
              <span className="text-fg">you</span> · javascript
            </span>
            <span>⌘/Ctrl + Enter to submit</span>
          </div>
          <div className="min-h-[320px] flex-1">
            <Editor
              defaultLanguage="javascript"
              defaultValue={STARTER}
              onChange={(v) => {
                codeRef.current = v ?? '';
              }}
              onMount={onMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          </div>

          {/* judge strip */}
          <div className="border-t border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={verdict === 'running' || result !== null}
                className="rounded-md px-4 py-2 text-sm font-semibold text-ink transition-transform enabled:hover:scale-[1.03] disabled:opacity-50"
                style={{ background: 'var(--color-gold)' }}
              >
                {verdict === 'running' ? 'Judging…' : 'Submit'}
              </button>
              <div className="flex flex-1 items-center gap-1.5" aria-label="test progress">
                {ARENA_TESTS.map((_, i) => {
                  const r = pips[i];
                  return (
                    <span
                      key={i}
                      className="h-1.5 flex-1 rounded-full transition-colors duration-200"
                      style={{
                        background: !r
                          ? 'var(--color-line)'
                          : r.pass
                            ? 'var(--color-green)'
                            : 'var(--color-red)',
                      }}
                    />
                  );
                })}
              </div>
              {verdict && verdict !== 'running' && (
                <span
                  className="stamp font-mono text-xs font-bold"
                  style={{
                    color: verdict === 'AC' ? 'var(--color-green)' : 'var(--color-red)',
                  }}
                >
                  {verdict === 'AC'
                    ? 'ACCEPTED'
                    : verdict === 'WA'
                      ? 'WRONG ANSWER'
                      : verdict === 'TLE'
                        ? 'TIME LIMIT'
                        : 'RUNTIME ERROR'}
                </span>
              )}
            </div>
            {judgeError && (
              <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--color-red)' }}>
                {judgeError}
              </p>
            )}
          </div>
        </section>

        {/* ── opponent panel ── */}
        <section className="bg-ink p-6">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: 'var(--color-red)' }}
              />
              <span className="text-fg">null_ptr</span>
              <span className="text-muted">1509</span>
            </span>
            <span className="text-muted">python</span>
          </div>
          <pre className="mt-3 h-56 overflow-hidden rounded-lg border border-line bg-panel p-3.5 font-mono text-[11px] leading-relaxed text-muted">
            <code className={opponentTyped < OPPONENT_CODE.length ? 'caret' : ''}>
              {OPPONENT_CODE.slice(0, opponentTyped)}
            </code>
          </pre>
          <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
            <span className="text-muted">status</span>
            <span
              style={{
                color:
                  opponentStatus === 'AC'
                    ? 'var(--color-green)'
                    : opponentStatus === 'WA'
                      ? 'var(--color-red)'
                      : 'var(--color-muted)',
              }}
            >
              {opponentStatus === 'typing'
                ? 'typing…'
                : opponentStatus === 'WA'
                  ? 'WRONG ANSWER — retrying'
                  : 'ACCEPTED'}
            </span>
          </div>
          <p className="mt-8 text-xs leading-relaxed text-muted">
            First accepted submission takes the match. The judge runs your code in an isolated
            worker with a hard 2.5&nbsp;s kill switch — infinite loops die, the tab doesn&apos;t.
          </p>
        </section>
      </main>

      {/* ── result overlay ── */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 backdrop-blur-sm">
          <div className="stamp mx-5 max-w-sm rounded-2xl border border-line bg-panel p-8 text-center">
            <p
              className="font-display text-3xl font-bold"
              style={{ color: result === 'win' ? 'var(--color-gold)' : 'var(--color-red)' }}
            >
              {result === 'win' ? 'VICTORY' : 'DEFEAT'}
            </p>
            <p className="mt-3 font-mono text-sm">
              {result === 'win' ? (
                <span style={{ color: 'var(--color-gold)' }}>you +24 Elo · 1487 → 1511</span>
              ) : (
                <span className="text-muted">null_ptr accepted first · you −18 Elo</span>
              )}
            </p>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              {result === 'win'
                ? 'All 8 test cases green. The rating is yours — it stays on your record.'
                : 'The hash-map beat the clock. Queue again and take it back.'}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md px-4 py-2 text-sm font-semibold text-ink"
                style={{ background: 'var(--color-gold)' }}
              >
                Rematch
              </button>
              <Link
                to="/"
                className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-fg hover:border-muted"
              >
                Back to arena
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
