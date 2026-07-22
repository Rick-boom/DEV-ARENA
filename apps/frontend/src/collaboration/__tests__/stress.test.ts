import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { SocketIOProvider } from '../providers/socket-io-provider.js';
import { AwarenessManager } from '../awareness/awareness-manager.js';
import { colorForUser } from '../utils/color.js';
import { SocketBus, flush, settle } from './test-harness.js';

/**
 * Stress tests: many simultaneous editors + high-frequency edits still
 * converge, and awareness scales to many participants. These exercise
 * the 100+ concurrent-editor target on a small scale for speed while
 * asserting the invariants that matter (convergence, no lost data).
 */
describe('stress', () => {
  it('converges with 30 concurrent editors each inserting', async () => {
    const bus = new SocketBus();
    const N = 30;
    const peers = Array.from({ length: N }, () => {
      const doc = new Y.Doc();
      const socket = bus.create();
      const provider = new SocketIOProvider('stress', doc, socket, new Awareness(doc), {
        connect: false,
      });
      return { doc, socket, provider, text: doc.getText('monaco') };
    });
    peers.forEach((p) => p.socket.connect());
    await flush();

    // Each peer appends a unique token.
    peers.forEach((p, i) => p.text.insert(p.text.length, `<${i}>`));
    await flush(10);

    const first = peers[0]!.text.toString();
    // All peers converge to the same document...
    for (const p of peers) expect(p.text.toString()).toBe(first);
    // ...and every peer's token is present (nothing lost).
    for (let i = 0; i < N; i += 1) expect(first).toContain(`<${i}>`);
  });

  it('handles rapid sequential edits from one peer', async () => {
    const bus = new SocketBus();
    const a = (() => {
      const doc = new Y.Doc();
      const socket = bus.create();
      new SocketIOProvider('rapid', doc, socket, new Awareness(doc), { connect: false });
      return { doc, socket, text: doc.getText('monaco') };
    })();
    const b = (() => {
      const doc = new Y.Doc();
      const socket = bus.create();
      new SocketIOProvider('rapid', doc, socket, new Awareness(doc), { connect: false });
      return { doc, socket, text: doc.getText('monaco') };
    })();
    a.socket.connect();
    b.socket.connect();
    await flush();

    for (let i = 0; i < 200; i += 1) a.text.insert(a.text.length, 'x');
    await settle(a.text, b.text);
    expect(b.text.length).toBe(200);
    expect(a.text.toString()).toBe(b.text.toString());
  });

  it('tracks many participants in awareness without collision', () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const mgr = new AwarenessManager(awareness, {
      userId: 'me',
      username: 'me',
      color: colorForUser('me'),
    });
    mgr.init('javascript', 'main.js');

    // Simulate 50 remote states landing in awareness.
    for (let i = 0; i < 50; i += 1) {
      awareness.states.set(1000 + i, {
        user: { userId: `u${i}`, username: `u${i}`, color: colorForUser(`u${i}`) },
        status: 'active',
        cursor: { lineNumber: 1, column: i },
        selection: null,
        language: 'javascript',
        file: 'main.js',
        lastActive: Date.now(),
      });
    }
    expect(mgr.getRemoteStates().size).toBe(50);
    mgr.destroy();
  });
});
