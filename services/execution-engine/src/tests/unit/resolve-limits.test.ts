import { describe, expect, it } from 'vitest';
import { resolveLimits } from '../../utils/resolve-limits.js';

/**
 * The clamp is a security control: a request must never be able to
 * raise a ceiling above the service maximum, only lower it.
 */
describe('resolveLimits', () => {
  it('applies service defaults when the request omits limits', () => {
    const l = resolveLimits({ language: 'python', code: 'x' });
    expect(l.timeLimitMs).toBe(5000);
    expect(l.memoryLimitMb).toBe(256);
  });

  it('honours a request that TIGHTENS the limits', () => {
    const l = resolveLimits({
      language: 'python',
      code: 'x',
      timeLimitMs: 1000,
      memoryLimitMb: 64,
    });
    expect(l.timeLimitMs).toBe(1000);
    expect(l.memoryLimitMb).toBe(64);
  });

  it('clamps a request that tries to RAISE limits above the max', () => {
    const l = resolveLimits({
      language: 'python',
      code: 'x',
      timeLimitMs: 999_999,
      memoryLimitMb: 999_999,
    });
    expect(l.timeLimitMs).toBe(5000); // clamped to MAX_EXECUTION_MS
    expect(l.memoryLimitMb).toBe(256); // clamped to MAX_MEMORY_MB
  });

  it('carries the fixed infrastructure ceilings through unchanged', () => {
    const l = resolveLimits({ language: 'cpp', code: 'x' });
    expect(l.compileMs).toBe(15000);
    expect(l.pids).toBeGreaterThan(0);
    expect(l.cpuCores).toBeGreaterThan(0);
    expect(l.outputBytes).toBeGreaterThan(0);
    expect(l.tmpfsMb).toBeGreaterThan(0);
  });
});
