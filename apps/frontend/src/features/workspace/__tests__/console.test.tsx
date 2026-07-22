import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeTestStore, screen, act } from '@/test/render.js';
import { ConsolePanel } from '../components/console-panel.js';
import { OutputPanel } from '../components/output-panel.js';
import { ResultPanel } from '../components/result-panel.js';
import { VERDICT_META } from '../components/verdict-meta.js';
import { runSucceeded, runFailed, submitResolved } from '@/store/slices/submission-slice.js';
import {
  Language,
  Verdict,
  type PublicTestCase,
  type SubmissionDetail,
} from '@/types/problem.types.js';

const testCases: PublicTestCase[] = [
  { id: 'tc1', input: '2 3', expectedOutput: '5', order: 0 },
  { id: 'tc2', input: '10 1', expectedOutput: '11', order: 1 },
];

describe('ConsolePanel', () => {
  it('exposes the panels as real tabs', () => {
    renderWithProviders(<ConsolePanel testCases={testCases} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /test cases/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches panel on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConsolePanel testCases={testCases} />);

    await user.click(screen.getByRole('tab', { name: /output/i }));
    expect(screen.getByRole('tab', { name: /output/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves between tabs with arrow keys', async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    renderWithProviders(<ConsolePanel testCases={testCases} />, { store });

    const first = screen.getByRole('tab', { name: /test cases/i });
    first.focus();
    await user.keyboard('{ArrowRight}');

    expect(store.getState().workspace.consoleTab).toBe('output');
  });

  it('collapses and restores the console', async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    renderWithProviders(<ConsolePanel testCases={testCases} />, { store });

    await user.click(screen.getByRole('button', { name: /collapse console/i }));
    expect(store.getState().workspace.consoleOpen).toBe(false);
    // The header stays reachable so the console can be brought back.
    expect(screen.getByRole('button', { name: /expand console/i })).toBeInTheDocument();
  });

  it('shows sample input and lets the user switch to custom input', async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    renderWithProviders(<ConsolePanel testCases={testCases} />, { store });

    expect(screen.getByText('2 3')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/custom input/i));
    expect(store.getState().submission.useCustomInput).toBe(true);
    expect(screen.getByLabelText(/stdin/i)).toBeInTheDocument();
  });
});

describe('OutputPanel', () => {
  it('prompts with the shortcut before anything has run', () => {
    renderWithProviders(<OutputPanel />);
    expect(screen.getByText(/run your code to see its output/i)).toBeInTheDocument();
  });

  it('separates stdout from stderr', () => {
    const store = makeTestStore();
    renderWithProviders(<OutputPanel />, { store });

    act(() => {
      store.dispatch(
        runSucceeded({
          stdout: 'hello',
          stderr: 'a warning',
          exitCode: 0,
          runtimeMs: 12,
          memoryKb: 2048,
          timedOut: false,
        }),
      );
    });

    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('a warning')).toBeInTheDocument();
    // Both blocks are labelled so neither can be mistaken for the other.
    expect(screen.getByText('stdout')).toBeInTheDocument();
    expect(screen.getByText('stderr')).toBeInTheDocument();
  });

  it('gives compile errors their own block', () => {
    const store = makeTestStore();
    renderWithProviders(<OutputPanel />, { store });

    act(() => {
      store.dispatch(
        runSucceeded({
          stdout: '',
          stderr: '',
          exitCode: 1,
          runtimeMs: 0,
          memoryKb: 0,
          timedOut: false,
          compileError: "expected ';'",
        }),
      );
    });

    expect(screen.getByText('Compiler')).toBeInTheDocument();
    expect(screen.getByText(/expected ';'/)).toBeInTheDocument();
  });

  it('reports an execution failure as an alert', () => {
    const store = makeTestStore();
    renderWithProviders(<OutputPanel />, { store });

    act(() => {
      store.dispatch(runFailed('The sandbox is unavailable.'));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/sandbox is unavailable/i);
  });
});

describe('ResultPanel', () => {
  function detail(overrides: Partial<SubmissionDetail> = {}): SubmissionDetail {
    return {
      id: 'sub-1',
      problemId: 'p1',
      language: Language.PYTHON,
      status: Verdict.ACCEPTED,
      runtimeMs: 40,
      memoryKb: 4096,
      createdAt: new Date().toISOString(),
      passed: 3,
      total: 3,
      results: [
        {
          testCaseId: 'a',
          order: 0,
          hidden: false,
          status: Verdict.ACCEPTED,
          runtimeMs: 10,
          memoryKb: 1,
        },
        {
          testCaseId: 'b',
          order: 1,
          hidden: true,
          status: Verdict.ACCEPTED,
          runtimeMs: 12,
          memoryKb: 1,
        },
        {
          testCaseId: 'c',
          order: 2,
          hidden: true,
          status: Verdict.ACCEPTED,
          runtimeMs: 18,
          memoryKb: 1,
        },
      ],
      ...overrides,
    };
  }

  it('explains an accepted verdict with the pass count', () => {
    const store = makeTestStore();
    renderWithProviders(<ResultPanel />, { store });

    act(() => store.dispatch(submitResolved(detail())) as unknown as void);

    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText(/3\/3 cases passed/)).toBeInTheDocument();
  });

  it('surfaces the first failing case, not just the verdict', () => {
    const store = makeTestStore();
    renderWithProviders(<ResultPanel />, { store });

    act(
      () =>
        store.dispatch(
          submitResolved(
            detail({
              status: Verdict.WRONG_ANSWER,
              passed: 1,
              total: 3,
              results: [
                {
                  testCaseId: 'a',
                  order: 0,
                  hidden: false,
                  status: Verdict.ACCEPTED,
                  runtimeMs: 10,
                  memoryKb: 1,
                },
                {
                  testCaseId: 'b',
                  order: 1,
                  hidden: true,
                  status: Verdict.WRONG_ANSWER,
                  runtimeMs: 12,
                  memoryKb: 1,
                },
                {
                  testCaseId: 'c',
                  order: 2,
                  hidden: true,
                  status: Verdict.SKIPPED,
                  runtimeMs: null,
                  memoryKb: null,
                },
              ],
            }),
          ),
        ) as unknown as void,
    );

    expect(screen.getByRole('heading', { name: 'Wrong Answer' })).toBeInTheDocument();
    expect(screen.getByText(/first failing case/i)).toBeInTheDocument();
    expect(screen.getByText(/Case 2 \(hidden\)/)).toBeInTheDocument();
  });

  it('renders a progressbar reflecting cases passed', () => {
    const store = makeTestStore();
    renderWithProviders(<ResultPanel />, { store });

    act(() => store.dispatch(submitResolved(detail({ passed: 2, total: 3 }))) as unknown as void);

    const bar = screen.getByRole('progressbar', { name: /test cases passed/i });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
  });
});

describe('verdict metadata', () => {
  it('gives every verdict a label and a plain-language explanation', () => {
    for (const verdict of Object.values(Verdict)) {
      const meta = VERDICT_META[verdict];
      expect(meta, `missing metadata for ${verdict}`).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.help.length).toBeGreaterThan(0);
    }
  });
});
