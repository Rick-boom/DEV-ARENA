import { describe, expect, it } from 'vitest';
import {
  allowedNext,
  canTransition,
  isTerminal,
} from '../../modules/battles/state/battle-state-machine.js';
import { RuntimeState } from '../../modules/battles/types/battle.types.js';

/**
 * The state machine is the single source of truth for legal battle
 * transitions; every service path is checked against it. These tests
 * lock the contract so an accidental edge addition/removal is caught.
 */
describe('battle state machine', () => {
  it('allows the happy-path lifecycle', () => {
    expect(canTransition(RuntimeState.WAITING, RuntimeState.COUNTDOWN)).toBe(true);
    expect(canTransition(RuntimeState.COUNTDOWN, RuntimeState.ACTIVE)).toBe(true);
    expect(canTransition(RuntimeState.ACTIVE, RuntimeState.FINISHED)).toBe(true);
  });

  it('allows pause/resume between ACTIVE and PAUSED', () => {
    expect(canTransition(RuntimeState.ACTIVE, RuntimeState.PAUSED)).toBe(true);
    expect(canTransition(RuntimeState.PAUSED, RuntimeState.ACTIVE)).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransition(RuntimeState.WAITING, RuntimeState.ACTIVE)).toBe(false);
    expect(canTransition(RuntimeState.WAITING, RuntimeState.PAUSED)).toBe(false);
    expect(canTransition(RuntimeState.COUNTDOWN, RuntimeState.PAUSED)).toBe(false);
    expect(canTransition(RuntimeState.FINISHED, RuntimeState.ACTIVE)).toBe(false);
  });

  it('marks only FINISHED/CANCELLED/EXPIRED terminal', () => {
    expect(isTerminal(RuntimeState.FINISHED)).toBe(true);
    expect(isTerminal(RuntimeState.CANCELLED)).toBe(true);
    expect(isTerminal(RuntimeState.EXPIRED)).toBe(true);
    expect(isTerminal(RuntimeState.ACTIVE)).toBe(false);
    expect(isTerminal(RuntimeState.WAITING)).toBe(false);
  });

  it('exposes allowed next states', () => {
    expect(allowedNext(RuntimeState.WAITING)).toContain(RuntimeState.COUNTDOWN);
    expect(allowedNext(RuntimeState.WAITING)).toContain(RuntimeState.CANCELLED);
    expect(allowedNext(RuntimeState.FINISHED)).toHaveLength(0);
  });
});
