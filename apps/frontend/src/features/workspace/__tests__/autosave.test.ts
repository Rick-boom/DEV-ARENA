import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createElement, type ReactNode } from 'react';
import { makeTestStore } from '@/test/render.js';
import { useAutosave, loadDraft } from '../hooks/use-autosave.js';
import { AUTOSAVE } from '@/constants/editor.js';
import { Language } from '@/types/problem.types.js';
import { formatMemory, formatRelativeTime, formatRuntime, formatPercent } from '@/utils/format.js';

function wrapper(store: ReturnType<typeof makeTestStore>) {
  return ({ children }: { children: ReactNode }) => createElement(Provider, { store, children });
}

describe('useAutosave', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  it('writes once after the user stops typing, not per keystroke', () => {
    const store = makeTestStore();
    const { rerender } = renderHook(
      ({ code }: { code: string }) => useAutosave('p1', Language.PYTHON, code),
      { initialProps: { code: 'a' }, wrapper: wrapper(store) },
    );

    rerender({ code: 'ab' });
    rerender({ code: 'abc' });
    // Nothing persisted while the debounce window is still open.
    expect(window.localStorage.getItem(AUTOSAVE.key('p1', Language.PYTHON))).toBeNull();

    vi.advanceTimersByTime(AUTOSAVE.DEBOUNCE_MS + 50);
    expect(loadDraft('p1', Language.PYTHON)).toBe('abc');
    vi.useRealTimers();
  });

  it('flushes a pending write when the editor unmounts', () => {
    const store = makeTestStore();
    const { unmount } = renderHook(() => useAutosave('p2', Language.CPP, 'int main(){}'), {
      wrapper: wrapper(store),
    });

    // Navigate away before the debounce fires.
    unmount();
    expect(loadDraft('p2', Language.CPP)).toBe('int main(){}');
    vi.useRealTimers();
  });

  it('keeps drafts for different languages apart in storage', () => {
    const store = makeTestStore();
    renderHook(() => useAutosave('p3', Language.PYTHON, 'py code'), { wrapper: wrapper(store) });
    vi.advanceTimersByTime(AUTOSAVE.DEBOUNCE_MS + 50);
    renderHook(() => useAutosave('p3', Language.JAVA, 'java code'), { wrapper: wrapper(store) });
    vi.advanceTimersByTime(AUTOSAVE.DEBOUNCE_MS + 50);

    expect(loadDraft('p3', Language.PYTHON)).toBe('py code');
    expect(loadDraft('p3', Language.JAVA)).toBe('java code');
    vi.useRealTimers();
  });
});

describe('formatters', () => {
  it('switches runtime units at a second', () => {
    expect(formatRuntime(42)).toBe('42 ms');
    expect(formatRuntime(1500)).toBe('1.50 s');
    expect(formatRuntime(null)).toBe('—');
  });

  it('switches memory units at a megabyte', () => {
    expect(formatMemory(512)).toBe('512 KB');
    expect(formatMemory(4096)).toBe('4.0 MB');
    expect(formatMemory(undefined)).toBe('—');
  });

  it('formats acceptance as a percentage', () => {
    expect(formatPercent(0.482)).toBe('48.2%');
  });

  it('renders recent times relatively', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    expect(formatRelativeTime(new Date().toISOString())).toBe('just now');
    expect(formatRelativeTime('not-a-date')).toBe('—');
  });
});
