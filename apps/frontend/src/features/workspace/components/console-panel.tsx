import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectWorkspace } from '@/store/selectors.js';
import { ConsoleTab, consoleTabChanged, consoleToggled } from '@/store/slices/workspace-slice.js';
import { TestCasePanel } from './testcase-panel.js';
import { OutputPanel } from './output-panel.js';
import { ResultPanel } from './result-panel.js';
import { cn } from '@/utils/cn.js';
import type { PublicTestCase } from '@/types/problem.types.js';

const TABS: { id: ConsoleTab; label: string }[] = [
  { id: ConsoleTab.TESTCASES, label: 'Test cases' },
  { id: ConsoleTab.OUTPUT, label: 'Output' },
  { id: ConsoleTab.RESULT, label: 'Result' },
];

/**
 * The bottom console. Tabs are real tabs — arrow-key navigable with
 * proper `role="tab"` wiring — rather than styled buttons, because this
 * is a keyboard-heavy surface for a keyboard-heavy audience.
 *
 * Collapsing keeps the header visible so the console can always be
 * brought back without hunting for a handle.
 */
export function ConsolePanel({ testCases }: { testCases: PublicTestCase[] }) {
  const dispatch = useAppDispatch();
  const { consoleTab, consoleOpen } = useAppSelector(selectWorkspace);

  const onTabKeyDown = (event: React.KeyboardEvent, index: number): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : (index - 1 + TABS.length) % TABS.length;
    dispatch(consoleTabChanged(TABS[next]!.id));
  };

  return (
    <section
      aria-label="Console"
      className="flex h-full min-h-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="flex shrink-0 items-center gap-1 px-2 py-1">
        <div role="tablist" aria-label="Console panels" className="flex gap-1">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              id={`console-tab-${tab.id}`}
              aria-selected={consoleTab === tab.id}
              aria-controls={`console-panel-${tab.id}`}
              tabIndex={consoleTab === tab.id ? 0 : -1}
              onClick={() => dispatch(consoleTabChanged(tab.id))}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] transition-colors',
                consoleTab === tab.id
                  ? 'bg-[var(--color-elevated)] text-[var(--color-fg)]'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={() => dispatch(consoleToggled())}
          aria-label={consoleOpen ? 'Collapse console' : 'Expand console'}
          aria-expanded={consoleOpen}
        >
          {consoleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {consoleOpen ? (
        <div
          role="tabpanel"
          id={`console-panel-${consoleTab}`}
          aria-labelledby={`console-tab-${consoleTab}`}
          className="min-h-0 flex-1 overflow-hidden"
        >
          {consoleTab === ConsoleTab.TESTCASES ? <TestCasePanel testCases={testCases} /> : null}
          {consoleTab === ConsoleTab.OUTPUT ? <OutputPanel /> : null}
          {consoleTab === ConsoleTab.RESULT ? <ResultPanel /> : null}
        </div>
      ) : null}
    </section>
  );
}
