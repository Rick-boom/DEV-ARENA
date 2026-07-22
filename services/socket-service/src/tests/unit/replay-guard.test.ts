import { describe, expect, it } from 'vitest';
import { acceptNonce } from '../../middlewares/replay-guard.js';
import type { SocketData } from '../../types/events.types.js';

function data(): SocketData {
  return {
    user: { id: 'u', role: 'USER', username: 'u' },
    lastNonce: 0,
    rateBucket: { windowStart: 0, count: 0 },
  };
}

describe('replay guard (nonce)', () => {
  it('accepts strictly increasing nonces', () => {
    const d = data();
    expect(acceptNonce(d, 1)).toBe(true);
    expect(acceptNonce(d, 2)).toBe(true);
    expect(acceptNonce(d, 3)).toBe(true);
  });

  it('rejects a replayed (equal) nonce', () => {
    const d = data();
    acceptNonce(d, 5);
    expect(acceptNonce(d, 5)).toBe(false);
  });

  it('rejects an out-of-order (lower) nonce', () => {
    const d = data();
    acceptNonce(d, 10);
    expect(acceptNonce(d, 4)).toBe(false);
  });

  it('rejects non-finite nonces', () => {
    const d = data();
    expect(acceptNonce(d, Number.NaN)).toBe(false);
    expect(acceptNonce(d, Infinity)).toBe(false);
  });
});
