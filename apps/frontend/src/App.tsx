import { AppProviders } from './app/providers.js';
import { AppRouter } from './app/router.js';

/**
 * Application root: providers wrap the route table. Both halves live in
 * app/ so this file stays a two-line statement of the app's shape.
 */
export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
