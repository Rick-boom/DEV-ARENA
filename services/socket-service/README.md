# @devarena/socket-service

Real-time communication backbone for DevArena. A Socket.IO gateway with
JWT handshake auth, room + presence managers, and Redis-adapter
horizontal scaling — the layer every live feature (battles,
collaboration, interviews) sits on top of.

## Run locally

```bash
pnpm --filter @devarena/socket-service dev
# health:   http://localhost:4100/health
# events:   http://localhost:4100/docs.json   (AsyncAPI)
```

Requires Redis. Connect a client to the **`/rt`** namespace with a JWT
in the handshake:

```ts
import { io } from 'socket.io-client';
const socket = io('ws://localhost:4100/rt', { auth: { token: ACCESS_JWT } });
socket.emit('room:create', { type: 'battle' }, (res) => console.log(res));
```

## Architecture

`Client → Gateway → Auth middleware → Room/Presence managers → Redis`

- **Gateway** owns the connection lifecycle (limits, rate limiting,
  handler registration, heartbeat, disconnect cleanup). No business rules.
- **Managers** (`RoomManager`, `PresenceManager`) hold every rule —
  capacity, ownership, presence — and depend on store *interfaces*, not
  Redis, so they unit-test with in-memory fakes.
- **Redis stores** hold authoritative room/presence state shared across
  nodes; the **Redis adapter** fans broadcasts out across nodes. Together
  they are the entire horizontal-scaling story.

## Rooms

Three types with per-type capacity: `battle` (2), `collaboration` (50),
`interview` (4). Owner-only delete + ownership transfer; auto-promotion
of a new owner if the owner disconnects while others remain; last member
out closes the room.

## Security

JWT verified at the handshake (unauthenticated sockets never reach a
handler); per-user connection limit (cross-node via Redis); per-socket
fixed-window rate limiting; monotonic-nonce replay protection on cursor
streams; payload validation (Zod) on every mutating event.

## Reliability

Socket.IO `connectionStateRecovery` transparently resumes a briefly
dropped session and replays missed events. A user with multiple tabs
stays present until their **last** socket disconnects.

## Scaling to 50k concurrent sockets

Run N stateless replicas of `dist/index.js` behind a sticky-session load
balancer. Per-process file-descriptor limits cap a single node in the
low thousands, so 50k is ~15–30 nodes; the Redis adapter makes them one
logical server. `src/tests/load/load-test-example.ts` shows how to fan
out synthetic clients to smoke-test the fan-out.
