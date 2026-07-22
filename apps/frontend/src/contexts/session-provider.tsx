import type { ReactNode } from 'react';
import { useSessionRecovery } from '@/hooks/use-session-recovery.js';
import { useAutoLogout } from '@/hooks/use-auto-logout.js';

/**
 * Owns the session lifecycle for the whole app: recover on boot, then
 * watch for idle and forced expiry. Mounted once, above the router, so
 * every route inherits a resolved auth status.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  useSessionRecovery();
  useAutoLogout();
  return <>{children}</>;
}
