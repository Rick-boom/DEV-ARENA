import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { OfflineStore, type KeyValueStore } from '../providers/offline-store.js';

/** In-memory KeyValueStore standing in for IndexedDB in jsdom. */
class MemoryStore implements KeyValueStore {
  map = new Map<string, Uint8Array>();
  async get(k: string) {
    return this.map.get(k) ?? null;
  }
  async set(k: string, v: Uint8Array) {
    this.map.set(k, v);
  }
  async delete(k: string) {
    this.map.delete(k);
  }
}

/**
 * Offline tests: edits made offline persist locally and reload into a
 * fresh doc, then merge cleanly when reconnected.
 */
describe('offline support', () => {
  it('persists edits and restores them into a new doc', async () => {
    const store = new MemoryStore();

    // Session 1: edit offline, persist.
    const doc1 = new Y.Doc();
    const off1 = new OfflineStore(doc1, store, 'room-off');
    await off1.whenReady();
    doc1.getText('monaco').insert(0, 'offline edit');
    await Promise.resolve();
    expect(store.map.size).toBe(1);

    // Session 2 (simulated reload): a new doc loads the persisted state.
    const doc2 = new Y.Doc();
    const off2 = new OfflineStore(doc2, store, 'room-off');
    await off2.whenReady();
    expect(doc2.getText('monaco').toString()).toBe('offline edit');
  });

  it('merges offline edits from two docs via the CRDT', async () => {
    // Two independently-edited docs, merged by exchanging state — proves
    // offline changes reconcile without a server.
    const docA = new Y.Doc();
    docA.getText('monaco').insert(0, 'AAA');
    const docB = new Y.Doc();
    docB.getText('monaco').insert(0, 'BBB');

    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);
    Y.applyUpdate(docA, updateB);
    Y.applyUpdate(docB, updateA);

    expect(docA.getText('monaco').toString()).toBe(docB.getText('monaco').toString());
    expect(docA.getText('monaco').length).toBe(6);
  });

  it('clears persisted state on request', async () => {
    const store = new MemoryStore();
    const doc = new Y.Doc();
    const off = new OfflineStore(doc, store, 'room-clear');
    await off.whenReady();
    doc.getText('monaco').insert(0, 'x');
    await Promise.resolve();
    await off.clear();
    expect(store.map.size).toBe(0);
  });
});
