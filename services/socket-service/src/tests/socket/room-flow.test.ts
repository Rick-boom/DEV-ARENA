import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { startTestServer, tokenFor, type TestServer } from '../fakes/test-server.js';
import { RoomType } from '../../types/domain.types.js';

/**
 * End-to-end room lifecycle + broadcast fan-out between two clients.
 */
describe('room flow', () => {
  let server: TestServer;
  const clients: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    clients.forEach((c) => c.close());
    clients.length = 0;
    await server.close();
  });

  const connect = async (user: string): Promise<Socket> => {
    const c = ioClient(server.url, {
      auth: { token: tokenFor(user) },
      transports: ['websocket'],
      reconnection: false,
    });
    clients.push(c);
    await new Promise<void>((resolve, reject) => {
      c.on('connect', resolve);
      c.on('connect_error', reject);
    });
    return c;
  };

  const emit = <T>(c: Socket, event: string, payload: unknown): Promise<T> =>
    new Promise((resolve) => c.emit(event, payload, resolve));

  it('creates, joins, and broadcasts user-joined to existing members', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');

    const created = await emit<{ ok: boolean; data: { room: { id: string } } }>(
      alice,
      'room:create',
      { type: RoomType.COLLABORATION },
    );
    expect(created.ok).toBe(true);
    const roomId = created.data.room.id;

    await emit(alice, 'room:join', { roomId });

    // Alice should hear about Bob joining.
    const joinedPromise = new Promise<{ participant: { userId: string } }>((resolve) => {
      alice.on('room:user-joined', resolve);
    });
    const bobJoin = await emit<{ ok: boolean; data: { participants: unknown[] } }>(
      bob,
      'room:join',
      { roomId },
    );
    expect(bobJoin.ok).toBe(true);

    const joined = await joinedPromise;
    expect(joined.participant.userId).toBe('bob');
    expect(bobJoin.data.participants.length).toBe(2);
  });

  it('rejects joining a full battle room with ROOM_FULL', async () => {
    const a = await connect('a');
    const b = await connect('b');
    const c = await connect('c');

    const { data } = await emit<{ data: { room: { id: string } } }>(a, 'room:create', {
      type: RoomType.BATTLE, // capacity 2
    });
    const roomId = data.room.id;
    await emit(a, 'room:join', { roomId });
    await emit(b, 'room:join', { roomId });

    const third = await emit<{ ok: boolean; error: { code: string } }>(c, 'room:join', { roomId });
    expect(third.ok).toBe(false);
    expect(third.error.code).toBe('ROOM_FULL');
  });

  it('returns ROOM_NOT_FOUND when joining a missing room', async () => {
    const a = await connect('a');
    const res = await emit<{ ok: boolean; error: { code: string } }>(a, 'room:join', {
      roomId: 'does-not-exist',
    });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('only the owner can delete; deletion closes the room for everyone', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const { data } = await emit<{ data: { room: { id: string } } }>(alice, 'room:create', {
      type: RoomType.COLLABORATION,
    });
    const roomId = data.room.id;
    await emit(alice, 'room:join', { roomId });
    await emit(bob, 'room:join', { roomId });

    // Non-owner delete is rejected.
    const denied = await emit<{ ok: boolean; error: { code: string } }>(bob, 'room:delete', {
      roomId,
    });
    expect(denied.error.code).toBe('UNAUTHORIZED');

    // Owner delete closes the room; bob hears room:closed.
    const closedPromise = new Promise<{ roomId: string }>((resolve) =>
      bob.on('room:closed', resolve),
    );
    await emit(alice, 'room:delete', { roomId });
    expect((await closedPromise).roomId).toBe(roomId);
  });

  it('propagates typing + cursor events to other members only', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const { data } = await emit<{ data: { room: { id: string } } }>(alice, 'room:create', {
      type: RoomType.COLLABORATION,
    });
    const roomId = data.room.id;
    await emit(alice, 'room:join', { roomId });
    await emit(bob, 'room:join', { roomId });

    const typingPromise = new Promise<{ userId: string; typing: boolean }>((resolve) =>
      bob.on('typing:changed', resolve),
    );
    alice.emit('typing:start', { roomId });
    const typing = await typingPromise;
    expect(typing.userId).toBe('alice');
    expect(typing.typing).toBe(true);

    const cursorPromise = new Promise<{ userId: string; cursor: { line: number } }>((resolve) =>
      bob.on('cursor:changed', resolve),
    );
    alice.emit('cursor:update', { roomId, cursor: { line: 7, column: 2 }, nonce: 1 });
    const cursor = await cursorPromise;
    expect(cursor.userId).toBe('alice');
    expect(cursor.cursor.line).toBe(7);
  });
});
