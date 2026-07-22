/**
 * Load-test EXAMPLE (not run in CI). Illustrates how to smoke the
 * service toward its 50k-connection target by fanning out N clients
 * that connect, join a shared room, and emit cursor churn.
 *
 * Run against a real server:
 *   REDIS_URL=redis://localhost:6379 JWT_ACCESS_SECRET=dev \
 *   npx tsx src/tests/load/load-test-example.ts ws://localhost:4100/rt 500
 *
 * For a true 50k test, shard this across machines (each process handles
 * a few thousand sockets due to per-process FD limits) and point them
 * at the load balancer in front of several service nodes. The Redis
 * adapter makes the nodes one logical server, so a cursor emitted on
 * node A reaches a subscriber on node B — that cross-node fan-out is
 * exactly what this exercises at scale.
 */
import { io as ioClient, type Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

async function main(): Promise<void> {
  const url = process.argv[2] ?? 'ws://localhost:4100/rt';
  const count = Number(process.argv[3] ?? 100);
  const secret = process.env.JWT_ACCESS_SECRET ?? 'dev';

  const sockets: Socket[] = [];
  let connected = 0;
  const start = Date.now();

  await Promise.all(
    Array.from({ length: count }, (_, i) => {
      const token = jwt.sign({ sub: `load-${i}`, username: `load-${i}`, role: 'USER' }, secret);
      const c = ioClient(url, { auth: { token }, transports: ['websocket'] });
      sockets.push(c);
      return new Promise<void>((resolve) => {
        c.on('connect', () => {
          connected += 1;
          resolve();
        });
        c.on('connect_error', () => resolve());
      });
    }),
  );

  console.log(`connected ${connected}/${count} in ${Date.now() - start}ms`);

  // Shared room; everyone emits cursor churn for 5s.
  const first = sockets[0];
  if (first) {
    await new Promise<void>((resolve) =>
      first.emit('room:create', { type: 'collaboration', roomId: 'load-room' }, () => resolve()),
    );
    sockets.forEach((c) => c.emit('room:join', { roomId: 'load-room' }, () => undefined));

    let nonce = 0;
    const timer = setInterval(() => {
      nonce += 1;
      sockets.forEach((c) =>
        c.emit('cursor:update', {
          roomId: 'load-room',
          cursor: { line: nonce % 100, column: 0 },
          nonce,
        }),
      );
    }, 100);
    setTimeout(() => {
      clearInterval(timer);
      sockets.forEach((c) => c.close());

      console.log('load example complete');
      process.exit(0);
    }, 5000);
  }
}

void main();
