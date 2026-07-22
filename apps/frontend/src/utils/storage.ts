/**
 * localStorage with guards. Private-mode Safari and disabled storage
 * both throw on access, and a crash in a preference read should never
 * take down the app — every operation degrades to a no-op.
 */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — preference simply won't persist */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* no-op */
    }
  },
};
