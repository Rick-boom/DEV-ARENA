import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * The signature element: a looping replay of a real 1v1.
 * Two editors type their solutions live; the judge lights test-case
 * pips; a verdict stamps down; the winner's Elo counts up.
 * Deterministic script (not random) so every loop lands the beat.
 */

const CYAN_CODE = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need))
      return [seen.get(need), i];
    seen.set(nums[i], i);
  }
}`;

const RED_CODE = `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]`;

const PIPS = 8;

type Verdict = 'idle' | 'running' | 'AC' | 'TLE';

interface Side {
  typed: number;
  pips: number;
  verdict: Verdict;
}

interface ReplayState {
  cyan: Side;
  red: Side;
  elo: number;
  phase: 'typing' | 'judging' | 'done';
}

const INITIAL: ReplayState = {
  cyan: { typed: 0, pips: 0, verdict: 'idle' },
  red: { typed: 0, pips: 0, verdict: 'idle' },
  elo: 0,
  phase: 'typing',
};

export function BattleReplay() {
  const [state, setState] = useState<ReplayState>(INITIAL);
  const reduceMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (reduceMotion) {
      // Static final frame: the story without the motion.
      setState({
        cyan: { typed: CYAN_CODE.length, pips: PIPS, verdict: 'AC' },
        red: { typed: RED_CODE.length, pips: 5, verdict: 'TLE' },
        elo: 24,
        phase: 'done',
      });
      return;
    }

    let cancelled = false;
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.current.push(id);
    };

    const runLoop = () => {
      setState(INITIAL);

      // 1 — both type; cyan is faster (shorter path to done)
      const typeMs = 26;
      for (let i = 1; i <= CYAN_CODE.length; i += 1) {
        schedule(
          () => setState((s) => ({ ...s, cyan: { ...s.cyan, typed: i } })),
          400 + i * typeMs,
        );
      }
      for (let i = 1; i <= RED_CODE.length; i += 1) {
        schedule(
          () => setState((s) => ({ ...s, red: { ...s.red, typed: i } })),
          400 + i * typeMs * 1.45,
        );
      }

      const cyanDone = 400 + CYAN_CODE.length * typeMs;

      // 2 — cyan submits: pips fill fast, all green → AC stamp
      schedule(
        () =>
          setState((s) => ({
            ...s,
            phase: 'judging',
            cyan: { ...s.cyan, verdict: 'running' },
          })),
        cyanDone + 250,
      );
      for (let p = 1; p <= PIPS; p += 1) {
        schedule(
          () => setState((s) => ({ ...s, cyan: { ...s.cyan, pips: p } })),
          cyanDone + 400 + p * 130,
        );
      }
      const cyanVerdictAt = cyanDone + 400 + PIPS * 130 + 220;
      schedule(
        () => setState((s) => ({ ...s, cyan: { ...s.cyan, verdict: 'AC' } })),
        cyanVerdictAt,
      );

      // 3 — red submits late; pip 6 stalls → TLE stamp
      const redDone = 400 + RED_CODE.length * typeMs * 1.45;
      schedule(
        () => setState((s) => ({ ...s, red: { ...s.red, verdict: 'running' } })),
        redDone + 250,
      );
      for (let p = 1; p <= 5; p += 1) {
        schedule(
          () => setState((s) => ({ ...s, red: { ...s.red, pips: p } })),
          redDone + 400 + p * 150,
        );
      }
      schedule(
        () => setState((s) => ({ ...s, red: { ...s.red, verdict: 'TLE' } })),
        redDone + 400 + 5 * 150 + 900,
      );

      // 4 — Elo counts up for the winner
      const eloAt = cyanVerdictAt + 500;
      for (let e = 1; e <= 24; e += 1) {
        schedule(() => setState((s) => ({ ...s, elo: e })), eloAt + e * 28);
      }
      schedule(() => setState((s) => ({ ...s, phase: 'done' })), eloAt + 24 * 28);

      // 5 — hold, then loop
      schedule(runLoop, Math.max(cyanVerdictAt, redDone + 2200) + 3600);
    };

    runLoop();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reduceMotion]);

  return (
    <div className="arena-tilt relative w-full max-w-2xl">
      {/* match header */}
      <div className="flex items-center justify-between rounded-t-xl border border-line bg-panel-2 px-4 py-2.5 font-mono text-[11px] tracking-wide text-muted">
        <span>
          BATTLE <span className="text-fg">#48211</span> · two-sum · EASY
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-red" />
          LIVE REPLAY
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px border-x border-b border-line bg-line sm:grid-cols-2">
        <EditorPane
          player="ryu_dev"
          rating={1487}
          accent="cyan"
          language="javascript"
          code={CYAN_CODE.slice(0, state.cyan.typed)}
          typing={state.cyan.typed < CYAN_CODE.length}
          side={state.cyan}
        />
        <EditorPane
          player="null_ptr"
          rating={1509}
          accent="red"
          language="python"
          code={RED_CODE.slice(0, state.red.typed)}
          typing={state.red.typed < RED_CODE.length}
          side={state.red}
        />
      </div>

      {/* rating strip */}
      <div className="flex items-center justify-between rounded-b-xl border border-t-0 border-line bg-panel px-4 py-2.5 font-mono text-xs">
        <span className="text-muted">
          judge&nbsp;median&nbsp;<span className="text-fg">96&nbsp;ms</span>
        </span>
        <span
          className={`font-semibold transition-opacity duration-300 ${
            state.elo > 0 ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ color: 'var(--color-gold)' }}
        >
          ryu_dev&nbsp;+{state.elo}&nbsp;Elo
        </span>
      </div>
    </div>
  );
}

function EditorPane(props: {
  player: string;
  rating: number;
  accent: 'cyan' | 'red';
  language: string;
  code: string;
  typing: boolean;
  side: Side;
}) {
  const accentVar = props.accent === 'cyan' ? 'var(--color-cyan)' : 'var(--color-red)';
  return (
    <div className="relative bg-panel">
      <div className="flex items-center justify-between px-3.5 pt-3 font-mono text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full" style={{ background: accentVar }} />
          <span className="text-fg">{props.player}</span>
          <span className="text-muted">{props.rating}</span>
        </span>
        <span className="text-muted">{props.language}</span>
      </div>

      <pre
        className="h-44 overflow-hidden px-3.5 pt-2 font-mono text-[10.5px] leading-relaxed sm:h-48 sm:text-[11px]"
        style={{ color: 'color-mix(in srgb, var(--color-fg) 88%, transparent)' }}
      >
        <code className={props.typing ? 'caret' : ''} style={{ color: 'inherit' }}>
          {props.code}
        </code>
      </pre>

      {/* test-case pips */}
      <div className="flex items-center gap-1.5 px-3.5 pb-3.5" aria-label="test case progress">
        {Array.from({ length: PIPS }, (_, i) => {
          const lit = i < props.side.pips;
          const failedHere = props.side.verdict === 'TLE' && i === props.side.pips;
          return (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-200"
              style={{
                background: failedHere
                  ? 'var(--color-red)'
                  : lit
                    ? 'var(--color-green)'
                    : 'var(--color-line)',
              }}
            />
          );
        })}
      </div>

      {/* verdict stamp */}
      {(props.side.verdict === 'AC' || props.side.verdict === 'TLE') && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="stamp rounded border-2 px-3 py-1 font-display text-sm font-bold tracking-widest"
            style={{
              borderColor: props.side.verdict === 'AC' ? 'var(--color-green)' : 'var(--color-red)',
              color: props.side.verdict === 'AC' ? 'var(--color-green)' : 'var(--color-red)',
              background: 'color-mix(in srgb, var(--color-ink) 72%, transparent)',
            }}
          >
            {props.side.verdict === 'AC' ? 'ACCEPTED' : 'TIME LIMIT'}
          </span>
        </div>
      )}
    </div>
  );
}
