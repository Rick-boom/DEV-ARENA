import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { SocketIOProvider } from '../providers/socket-io-provider.js';
import { SocketBus, flush } from './test-harness.js';

/**
 * Synchronization tests: two peers editing one logical document via real
 * SocketIOProviders over the in-memory bus converge to identical text.
 */
describe('real-time synchronization', () => {
  function peer(bus: SocketBus, room = 'r1') {
    const doc = new Y.Doc();
    const socket = bus.create();
    const awareness = new Awareness(doc);
    const provider = new SocketIOProvider(room, doc, socket, awareness, { connect: false });
    return { doc, socket, awareness, provider, text: doc.getText('monaco') };
  }

  it('propagates an insert from one peer to another', async () => {
    const bus = new SocketBus();
    const a = peer(bus);
    const b = peer(bus);
    a.socket.connect();
    b.socket.connect();
    await flush();

    a.text.insert(0, 'hello');
    await flush();
    expect(b.text.toString()).toBe('hello');
  });

  it('syncs pre-existing content to a peer that joins later', async () => {
    const bus = new SocketBus();
    const a = peer(bus);
    a.socket.connect();
    a.text.insert(0, 'function main() {}');
    await flush();

    // b joins after a already has content
    const b = peer(bus);
    b.socket.connect();
    await flush();
    expect(b.text.toString()).toBe('function main() {}');
  });

  it('converges with interleaved edits from both peers', async () => {
    const bus = new SocketBus();
    const a = peer(bus);
    const b = peer(bus);
    a.socket.connect();
    b.socket.connect();
    await flush();

    a.text.insert(0, 'AAA');
    await flush();
    b.text.insert(3, 'BBB');
    await flush();

    expect(a.text.toString()).toBe(b.text.toString());
    expect(a.text.toString()).toBe('AAABBB');
  });
});
