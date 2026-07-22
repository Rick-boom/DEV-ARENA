import { useEffect, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectTheme } from '@/store/selectors.js';
import { systemThemeChanged } from '@/store/slices/theme-slice.js';
import { ThemeMode } from '@/types/ui.types.js';

/**
 * Applies the resolved theme to <html> and keeps "system" mode live.
 *
 * There's no React context here on purpose: the theme already lives in
 * Redux, and a second source of truth would be one more thing to keep in
 * sync. This component's only job is the DOM side effect — mirroring
 * state onto the document element where CSS can see it.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { mode, resolved } = useAppSelector(selectTheme);

  // Mirror the resolved theme onto <html> for the CSS token layer.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  }, [resolved]);

  // Follow the OS while the user is on "system".
  useEffect(() => {
    if (mode !== ThemeMode.SYSTEM || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const handle = (event: MediaQueryListEvent): void => {
      dispatch(systemThemeChanged(event.matches ? 'light' : 'dark'));
    };
    query.addEventListener('change', handle);
    return () => query.removeEventListener('change', handle);
  }, [mode, dispatch]);

  return <>{children}</>;
}
