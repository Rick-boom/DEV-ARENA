import * as Y from 'yjs';

/**
 * ── Offline support via local persistence ───────────────────────────
 * A CRDT's superpower is that offline edits are first-class: you keep
 * editing a local Y.Doc with no connection, accumulating updates, and on
 * reconnect those updates merge cleanly with everyone else's because
 * they're commutative. For that to survive a page reload while offline,
 * the doc must be persisted locally. This store snapshots the Y.Doc into
 * IndexedDB on every update and reloads it on construction.
 *
 * We depend on a tiny IDB port so the whole thing is testable with an
 * in-memory fake (jsdom has no real IndexedDB). This is deliberately a
 * compact implementation rather than pulling y-indexeddb, to keep the
 * dependency surface small and the behavior explicit.
 */
export interface KeyValueStore {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

export class OfflineStore {
  private readonly key: string;
  private synced = false;

  constructor(
    private readonly doc: Y.Doc,
    private readonly store: KeyValueStore,
    roomName: string,
  ) {
    this.key = `ydoc:${roomName}`;
  }

  /** Load any persisted state into the doc, then start persisting updates. */
  async whenReady(): Promise<void> {
    const persisted = await this.store.get(this.key);
    if (persisted && persisted.byteLength > 0) {
      // Applying a stored update is just another CRDT merge — safe even if
      // the doc already has content (e.g. from a fast server sync).
      Y.applyUpdate(this.doc, persisted, 'offline-store');
    }
    this.synced = true;
    this.doc.on('update', this.persist);
  }

  private persist = (_update: Uint8Array, origin: unknown): void => {
    if (!this.synced || origin === 'offline-store') return;
    // Persist the FULL document state (not just the delta) so a reload
    // reconstructs everything in one read. Yjs state is compact.
    void this.store.set(this.key, Y.encodeStateAsUpdate(this.doc));
  };

  async clear(): Promise<void> {
    await this.store.delete(this.key);
  }

  destroy(): void {
    this.doc.off('update', this.persist);
  }
}

/** IndexedDB-backed KeyValueStore for the browser. */
export class IndexedDbStore implements KeyValueStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  constructor(
    private readonly dbName = 'devarena-collab',
    private readonly storeName = 'ydocs',
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(this.storeName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async get(key: string): Promise<Uint8Array | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).get(key);
      req.onsuccess = () => resolve((req.result as Uint8Array) ?? null);
      req.onerror = () => reject(req.error);
    });
  }
  async set(key: string, value: Uint8Array): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async delete(key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
