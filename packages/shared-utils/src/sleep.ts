/** Promise-based sleep. Used by retry/backoff helpers later. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
