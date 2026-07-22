import { useEffect, useState } from 'react';

/**
 * Tracks connectivity. `navigator.onLine` only proves the machine has a
 * network interface, not that the API is reachable — so this is used for
 * the offline BANNER (a hint), while actual request failures are still
 * surfaced by the error layer. It's the honest reading of what the
 * browser can tell us.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
