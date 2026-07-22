import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectSubmissionState } from '@/store/selectors.js';
import { customInputChanged, customInputToggled } from '@/store/slices/submission-slice.js';
import { cn } from '@/utils/cn.js';
import type { PublicTestCase } from '@/types/problem.types.js';

/**
 * Sample cases + a custom-input escape hatch.
 *
 * "Run" uses whichever is selected. Custom input matters because the
 * fastest way to understand a wrong answer is usually to feed the
 * program a case you invented, not to re-read the samples.
 */
export function TestCasePanel({ testCases }: { testCases: PublicTestCase[] }) {
  const dispatch = useAppDispatch();
  const { customInput, useCustomInput } = useAppSelector(selectSubmissionState);
  const [activeCase, setActiveCase] = useState(0);

  const selected = testCases[activeCase];

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        {testCases.map((testCase, index) => (
          <button
            key={testCase.id}
            type="button"
            onClick={() => setActiveCase(index)}
            aria-pressed={activeCase === index && !useCustomInput}
            className={cn(
              'rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors',
              activeCase === index && !useCustomInput
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-elevated)]',
            )}
          >
            Case {index + 1}
          </button>
        ))}

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
          <Checkbox checked={useCustomInput} onChange={() => dispatch(customInputToggled())} />
          Custom input
        </label>
      </div>

      {useCustomInput ? (
        <div className="flex flex-1 flex-col gap-1.5">
          <label
            htmlFor="custom-input"
            className="font-mono text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase"
          >
            stdin
          </label>
          <textarea
            id="custom-input"
            value={customInput}
            onChange={(event) => dispatch(customInputChanged(event.target.value))}
            spellCheck={false}
            placeholder="Type the input your program should read…"
            className={cn(
              'min-h-24 flex-1 resize-none rounded-lg border border-[var(--color-border)]',
              'bg-[var(--color-canvas)] p-3 font-mono text-[12px] text-[var(--color-fg)]',
              'placeholder:text-[var(--color-fg-subtle)]',
              'focus:border-[var(--color-accent)] focus:outline-none',
            )}
          />
        </div>
      ) : selected ? (
        <div className="flex flex-col gap-3">
          <Field label="Input" value={selected.input} />
          <Field label="Expected" value={selected.expectedOutput} />
        </div>
      ) : (
        <p className="text-[13px] text-[var(--color-fg-muted)]">
          This problem has no sample cases. Use custom input to try your code.
        </p>
      )}

      {!useCustomInput ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-auto w-fit"
          onClick={() => dispatch(customInputToggled())}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add your own case
        </Button>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
        {label}
      </span>
      <pre className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-3 font-mono text-[12px] whitespace-pre-wrap text-[var(--color-fg)]">
        {value}
      </pre>
    </div>
  );
}
