import type { CollabSocket } from '../types/collab.types.js';

/**
 * An in-memory socket hub that mimics the Socket.IO server's room
 * broadcast: a message emitted by one fake socket is delivered to every
 * OTHER fake socket in the same room. This lets us exercise the real
 * SocketIOProvider end-to-end (real Yjs sync protocol) with no network.
 */
export class SocketBus {
  private readonly sockets = new Set<FakeSocket>();

  create(): FakeSocket {
    const socket = new FakeSocket(this);
    this.sockets.add(socket);
    return socket;
  }

  broadcast(from: FakeSocket, event: string, args: unknown[]): void {
    for (const s of this.sockets) {
      if (s === from || !s.connected) continue;
      s.receive(event, args);
    }
  }

  remove(socket: FakeSocket): void {
    this.sockets.delete(socket);
  }
}

export class FakeSocket implements CollabSocket {
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private _connected = false;

  constructor(private readonly bus: SocketBus) {}

  get connected(): boolean {
    return this._connected;
  }

  connect(): void {
    this._connected = true;
    this.fire('connect');
  }

  disconnect(): void {
    this._connected = false;
    this.fire('disconnect');
  }

  emit(event: string, ...args: unknown[]): void {
    // Application messages fan out via the bus; lifecycle events are local.
    this.bus.broadcast(this, event, args);
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener?: (...args: unknown[]) => void): void {
    if (!listener) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.get(event)?.delete(listener);
  }

  /** Called by the bus to deliver a peer's message. */
  receive(event: string, args: unknown[]): void {
    this.fire(event, ...args);
  }

  private fire(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((l) => l(...args));
  }
}

/** Let microtasks (provider sync round-trips) settle. */
export function flush(times = 5): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const tick = (): void => {
      n += 1;
      if (n >= times) resolve();
      else queueMicrotask(tick);
    };
    queueMicrotask(tick);
  });
}

/**
 * Flush repeatedly until the two Yjs text fields converge (or a cap is
 * hit). Sync over the bus takes several round-trips (Step1 → Step2 →
 * update echoes); this settles them deterministically without guessing a
 * fixed flush count.
 */
export async function settle(
  a: { toString(): string },
  b: { toString(): string },
  maxRounds = 30,
): Promise<void> {
  for (let i = 0; i < maxRounds; i += 1) {
    await flush(4);
    if (a.toString() === b.toString()) return;
  }
}
