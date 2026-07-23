# DevArena Collaborative Editing Engine

Conflict-free, real-time collaborative code editing for DevArena's battle,
collaboration, and interview rooms — the Google-Docs / VS-Code-Live-Share
experience, built on **Yjs + Monaco** and running over the **existing
Socket.IO** infrastructure (no second WebSocket server).

## Architecture

```
Monaco Editor  →  Y.Text (CRDT)  →  Awareness  →  SocketIOProvider  →  Socket.IO  →  Remote users
     ▲                 │                                   │
     └── y-monaco binding (2-way)                          └── OfflineStore (IndexedDB) + ReconnectManager + VersionRecovery
```

The single shared `Y.Doc` **is** the source of truth. Monaco, React state,
and remote cursors are all projections of it.

## How to use

```tsx
import { CollaborativeEditor } from './collaboration/components/CollaborativeEditor';
import { IndexedDbStore } from './collaboration';

<CollaborativeEditor
  options={{
    roomName: 'battle-123',
    roomType: 'battle',
    identity: { userId, username, avatarUrl }, // color auto-derived
    socket, // your existing Socket.IO client
    language: 'typescript',
    file: 'solution.ts',
    offlineStore: new IndexedDbStore(), // enables offline support
    enableVersionRecovery: true, // enables snapshots
  }}
/>;
```

The hooks (`useCollaborationSession`, `useMonacoCollaboration`, `usePresence`)
are exported for building a custom UI.

## CRDT concepts used (and where)

- **CRDT (Conflict-free Replicated Data Type)** — a structure every peer can
  edit independently that always converges once updates are exchanged, with no
  central arbiter. Yjs provides a **text CRDT (YATA)**: every inserted character
  is an immutable item with a unique `(client, clock)` id linked to the item it
  followed. This is what makes editing _conflict-free by construction_.
- **Deterministic concurrent ordering** — when two people insert at the "same"
  spot, the item ids break the tie identically on every peer, so nothing is lost
  and everyone sees the same order. (`conflict.test.ts` proves this.)
- **Commutativity + idempotency** — updates can arrive in any order, or twice,
  and still converge. This is what makes offline edits and reconnect-resync
  safe. (`offline.test.ts`, `reconnect.test.ts`.)
- **State-vector sync (SyncStep1/2)** — a peer sends a compact summary of what
  it has seen; the other replies with only the missing diff. Reconnect just
  re-runs this, so catch-up is O(missed updates). (`providers/socket-io-provider.ts`.)
- **Awareness** — an _ephemeral_ CRDT sibling (last-write-wins per client, with
  timeout) for cursors, selections, and presence, kept **out** of the document
  so it vanishes when a user leaves. (`awareness/awareness-manager.ts`.)
- **Origin-scoped UndoManager** — undo tracks only the local user's operations,
  so Ctrl+Z never reverts a collaborator's keystroke. (`sync/undo-manager.ts`.)
- **Snapshots** — an immutable `(state vector + delete set)` pin of a past
  version, materialized on demand for version recovery without storing full
  copies. (`sync/version-recovery.ts`.)

## Why CRDT beats Operational Transformation (OT) for this project

Both solve concurrent editing, but they make very different trade-offs:

1. **No central transform server.** OT requires a server that transforms every
   operation against concurrent ones and imposes a global order; correct OT
   transform functions are notoriously hard to get right (Google Docs shipped
   years of edge-case fixes). A CRDT merges **peer-to-peer** with no server-side
   transform logic — DevArena's Socket.IO server just relays opaque binary
   updates. Less server code, fewer correctness landmines.
2. **Offline-first is native.** In OT, operations are defined relative to a
   server-acknowledged revision, so long offline editing and reconnection are
   painful. CRDT updates are self-contained and commutative, so a user can edit
   offline for an arbitrary time and merge cleanly on reconnect — exactly what a
   flaky-network coding battle needs.
3. **Convergence is guaranteed by the data type, not by protocol discipline.**
   OT correctness depends on every op passing through the transform pipeline in
   the right order. A CRDT converges even with out-of-order or duplicated
   delivery — which is precisely the failure mode of a real network.
4. **Scales to many editors cheaply.** OT's transform cost grows with concurrent
   op complexity and needs the server in the hot path. Yjs merges are local and
   the sync is a compact diff, so 100+ simultaneous editors stay light on both
   bandwidth and server CPU.

The one CRDT cost — retaining item metadata/tombstones — Yjs mitigates with an
efficient encoding and optional garbage collection (which we disable only when
version recovery needs history).

## Files

- `providers/socket-io-provider.ts` — Yjs sync + awareness over the existing socket.
- `providers/offline-store.ts` — IndexedDB persistence for offline support.
- `awareness/awareness-manager.ts` — typed presence/cursor/selection + idle.
- `bindings/monaco-binding.ts` — Monaco ↔ Y.Text via y-monaco.
- `cursor/remote-cursors.ts` — remote carets/selections as Monaco decorations.
- `sync/undo-manager.ts` — collaborative (local-scoped) undo/redo.
- `sync/reconnect-manager.ts` — reconnect + resync with backoff.
- `sync/version-recovery.ts` — snapshot capture / restore.
- `collaboration-session.ts` — composition root wiring it all together.
- `hooks/` — React entry points.
- `components/CollaborativeEditor.tsx` — reference UI.
- `__tests__/` — sync, conflict, reconnect, offline, and stress tests.
