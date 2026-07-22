import { RuntimeState } from '../types/battle.types.js';

/**
 * The battle lifecycle as an explicit finite state machine. Centralizing
 * the legal transitions here means every service path — REST, socket,
 * scheduler — is checked against ONE source of truth, so an out-of-order
 * request (e.g. pause a WAITING battle) is rejected uniformly rather than
 * corrupting state. Terminal states have no outgoing edges.
 */
const TRANSITIONS: Record<RuntimeState, readonly RuntimeState[]> = {
  [RuntimeState.WAITING]: [RuntimeState.COUNTDOWN, RuntimeState.CANCELLED, RuntimeState.EXPIRED],
  [RuntimeState.COUNTDOWN]: [RuntimeState.ACTIVE, RuntimeState.CANCELLED],
  [RuntimeState.ACTIVE]: [RuntimeState.PAUSED, RuntimeState.FINISHED, RuntimeState.EXPIRED],
  [RuntimeState.PAUSED]: [RuntimeState.ACTIVE, RuntimeState.FINISHED, RuntimeState.EXPIRED],
  [RuntimeState.FINISHED]: [],
  [RuntimeState.CANCELLED]: [],
  [RuntimeState.EXPIRED]: [],
};

export function canTransition(from: RuntimeState, to: RuntimeState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(state: RuntimeState): boolean {
  return TRANSITIONS[state].length === 0;
}

export function allowedNext(from: RuntimeState): readonly RuntimeState[] {
  return TRANSITIONS[from];
}
