import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { SocketIOProvider } from '../providers/socket-io-provider.js';
import { ConnectionState } from '../types/collab.types.js';
import { SocketBus, flush, settle } from './test-harness.js';

/**
 * Reconnect tests: after a drop, a peer catches up on everything it
 * missed once the socket returns (state-vector resync).
 */
describe('reconnect + resync', () => {
  function peer(bus: SocketBus, room = 'rc1') {
    const doc = new Y.Doc();
    const socket = bus.create();
    const provider = new SocketIOProvider(room, doc, socket, new Awareness(doc), {
      connect: false,
    });
    return { doc, socket, provider, text: doc.getText('monaco') };
  }

  it('reports SYNCED after the initial sync round-trip', async () => {
    const bus = new SocketBus();
    const a = peer(bus);
    const b = peer(bus);
    a.socket.connect();
    a.text.insert(0, 'seed');
    await flush();
    b.socket.connect();
    await flush(5);
    expect(b.provider.state).toBe(ConnectionState.SYNCED);
  });

  it('catches up on edits made while it was disconnected', async () => {
    const bus = new SocketBus();
    const a = peer(bus);
    const b = peer(bus);
    a.socket.connect();
    b.socket.connect();
    await flush();

    // b drops; a keeps editing
    b.socket.disconnect();
    a.text.insert(0, 'while-away ');
    a.text.insert(11, 'more ');
    await flush();

    // b comes back → resync pulls the missed updates
    b.socket.connect();
    b.provider.resync();
    await settle(a.text, b.text);
    expect(b.text.toString()).toBe(a.text.toString());
    expect(b.text.toString()).toContain('while-away');
  });

  it('surfaces DISCONNECTED state on drop', async () => {
    const bus = new SocketBus();
    const a = peer(bus);
    const states: ConnectionState[] = [];
    a.provider.on('status', (s: ConnectionState) => states.push(s));
    a.socket.connect();
    await flush();
    a.socket.disconnect();
    await flush();
    expect(states).toContain(ConnectionState.DISCONNECTED);
  });
});
