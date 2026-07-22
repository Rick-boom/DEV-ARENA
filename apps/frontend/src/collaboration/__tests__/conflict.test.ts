import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { SocketIOProvider } from '../providers/socket-io-provider.js';
import { SocketBus, flush, settle } from './test-harness.js';

/**
 * Conflict tests: concurrent edits at the SAME position must merge
 * deterministically with no lost characters — the core CRDT guarantee.
 */
describe('conflict-free concurrent editing', () => {
  function peer(bus: SocketBus, room = 'c1') {
    const doc = new Y.Doc();
    const socket = bus.create();
    const provider = new SocketIOProvider(room, doc, socket, new Awareness(doc), {
      connect: false,
    });
    return { doc, socket, provider, text: doc.getText('monaco') };
  }

  it('merges concurrent inserts at the same index without data loss', async () => {
    const bus = new SocketBus();
    const a = peer(bus);
    const b = peer(bus);
    a.socket.connect();
    b.socket.connect();
    await flush();
    // seed shared content
    a.text.insert(0, 'XY');
    await flush();

    // Disconnect both, edit the same spot concurrently, reconnect.
    a.socket.disconnect();
    b.socket.disconnect();
    a.text.insert(1, 'AAA'); // X[AAA]Y locally
    b.text.insert(1, 'BBB'); // X[BBB]Y locally
    a.socket.connect();
    b.socket.connect();
    // With both back online, re-announce state vectors so each peer pulls
    // the other's offline edits (a real server relays this automatically).
    a.provider.resync();
    b.provider.resync();
    await settle(a.text, b.text);

    // Both converge to the same string, and every character survives.
    expect(a.text.toString()).toBe(b.text.toString());
    expect(a.text.toString()).toContain('AAA');
    expect(a.text.toString()).toContain('BBB');
    expect(a.text.length).toBe(8); // 2 seed + 3 + 3
  });

  it('is order-independent (commutative merge)', async () => {
    const bus = new SocketBus();
    const a = peer(bus, 'c2');
    const b = peer(bus, 'c2');
    a.socket.connect();
    b.socket.connect();
    await flush();

    a.socket.disconnect();
    b.socket.disconnect();
    a.text.insert(0, 'first');
    b.text.insert(0, 'second');
    // Reconnect in reverse order — result must still match.
    b.socket.connect();
    a.socket.connect();
    a.provider.resync();
    b.provider.resync();
    await settle(a.text, b.text);

    expect(a.text.toString()).toBe(b.text.toString());
  });
});
