import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Global test setup. jsdom is missing several browser APIs the shell
 * relies on, so they're stubbed once here rather than in every file.
 */
afterEach(() => cleanup());

// Theme provider queries this on mount.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }),
});

// Framer Motion + Radix measure elements jsdom won't lay out.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.scrollTo = vi.fn();
