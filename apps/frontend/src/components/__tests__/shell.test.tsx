import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeTestStore, screen, act } from '@/test/render.js';
import { ThemeToggle } from '@/components/molecules/theme-toggle.js';
import { Toaster } from '@/components/organisms/toaster.js';
import { ErrorBoundary } from '@/components/organisms/error-boundary.js';
import { Button } from '@/components/ui/button.js';
import { notify } from '@/store/slices/notification-slice.js';
import { ThemeMode } from '@/types/ui.types.js';

describe('ThemeToggle', () => {
  it('states what pressing it will do, not just the current state', () => {
    const store = makeTestStore();
    store.dispatch({ type: 'theme/themeSet', payload: ThemeMode.LIGHT });
    renderWithProviders(<ThemeToggle />, { store });
    expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
  });

  it('cycles the mode on click', async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch({ type: 'theme/themeSet', payload: ThemeMode.LIGHT });
    renderWithProviders(<ThemeToggle />, { store });

    await user.click(screen.getByRole('button'));
    expect(store.getState().theme.mode).toBe(ThemeMode.DARK);

    await user.click(screen.getByRole('button'));
    expect(store.getState().theme.mode).toBe(ThemeMode.SYSTEM);
  });
});

describe('Toaster', () => {
  it('renders queued notifications in a polite live region', () => {
    const store = makeTestStore();
    renderWithProviders(<Toaster />, { store });

    act(() => {
      store.dispatch(notify({ title: 'Signed in', description: 'Welcome back' }));
    });

    expect(screen.getByText('Signed in')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('dismisses a toast from its labelled close button', async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    renderWithProviders(<Toaster />, { store });

    act(() => {
      store.dispatch(notify({ title: 'Saved' }));
    });

    await user.click(screen.getByRole('button', { name: /dismiss: saved/i }));
    expect(store.getState().notification.items).toHaveLength(0);
  });

  it('auto-dismisses after the stated duration', () => {
    vi.useFakeTimers();
    const store = makeTestStore();
    renderWithProviders(<Toaster />, { store });

    act(() => {
      store.dispatch(notify({ title: 'Transient', duration: 3000 }));
    });
    expect(store.getState().notification.items).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(store.getState().notification.items).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe('ErrorBoundary', () => {
  function Boom(): never {
    throw new Error('render exploded');
  }

  it('catches a render crash and offers a way out', () => {
    // React logs the caught error; silence it so the run stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/this screen stopped working/i)).toBeInTheDocument();
    expect(screen.getByText(/render exploded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders children when nothing throws', () => {
    renderWithProviders(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('marks itself busy and disabled while loading', () => {
    renderWithProviders(<Button loading>Save changes</Button>);
    const button = screen.getByRole('button', { name: /save changes/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('renders as a child element when asChild is set', () => {
    renderWithProviders(
      <Button asChild>
        <a href="/somewhere">Go</a>
      </Button>,
    );
    // A link, not a button — valid markup and correct keyboard semantics.
    expect(screen.getByRole('link', { name: 'Go' })).toBeInTheDocument();
  });
});
