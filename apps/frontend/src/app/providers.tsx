import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { store } from '@/store/index.js';
import { ThemeProvider } from '@/contexts/theme-provider.js';
import { SessionProvider } from '@/contexts/session-provider.js';

/**
 * Provider stack, outermost first. Order is load-bearing:
 *   Redux   — everything below reads state
 *   Router  — SessionProvider's logout needs navigation
 *   Theme   — paints before content to avoid a flash of the wrong theme
 *   Session — recovers the session for the router's guards
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ReduxProvider>
  );
}
