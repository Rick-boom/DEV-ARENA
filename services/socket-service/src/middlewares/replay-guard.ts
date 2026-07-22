import type { SocketData } from '../types/events.types.js';
import { env } from '../config/env.js';

/**
 * Replay protection for ordered, mutating stream events (cursor moves).
 * Each such event carries a strictly-increasing `nonce`; the socket
 * tracks the highest accepted value. A nonce ≤ the high-water mark is a
 * replayed or out-of-order packet and is rejected. This stops a captured
 * cursor/typing packet from being replayed to desync collaborators, and
 * cheaply discards stale UDP-like reordering on flaky links.
 *
 * The nonce is monotonic per socket; on reconnect the socket is new, so
 * the client resets its counter too. A wall-clock guard also rejects
 * anything absurdly old to bound state.
 */
export function acceptNonce(data: SocketData, nonce: number): boolean {
  if (!Number.isFinite(nonce)) return false;
  if (nonce <= data.lastNonce) return false;
  data.lastNonce = nonce;
  return true;
}

/** Optional timestamp-based staleness check for replayed captures. */
export function isFresh(timestampMs: number): boolean {
  return Date.now() - timestampMs <= env.REPLAY_WINDOW_MS;
}
