import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { startTestServer, tokenFor, type TestServer } from '../fakes/test-server.js';

/**
 * Socket tests: real client ↔ real server over websockets. Covers the
 * handshake auth gate and the connection-limit security control.
 */
describe('connection + auth', () => {
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

  const connect = (token?: string): Socket => {
    const c = ioClient(server.url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
    });
    clients.push(c);
    return c;
  };

  it('accepts a socket with a valid token', async () => {
    const c = connect(tokenFor('alice'));
    await new Promise<void>((resolve, reject) => {
      c.on('connect', resolve);
      c.on('connect_error', reject);
    });
    expect(c.connected).toBe(true);
  });

  it('rejects a socket with no token', async () => {
    const c = connect();
    const err = await new Promise<Error>((resolve) => c.on('connect_error', resolve));
    expect(err.message).toMatch(/token/i);
  });

  it('rejects a socket with a garbage token', async () => {
    const c = connect('not-a-jwt');
    const err = await new Promise<Error>((resolve) => c.on('connect_error', resolve));
    expect(err).toBeDefined();
    expect(c.connected).toBe(false);
  });

  it('enforces the per-user connection limit', async () => {
    // test env MAX_CONNECTIONS_PER_USER = 3
    const token = tokenFor('bob');
    const connected: Socket[] = [];
    for (let i = 0; i < 3; i += 1) {
      const c = connect(token);
      await new Promise<void>((resolve) => c.on('connect', resolve));
      connected.push(c);
    }
    // 4th connection should be force-disconnected with an error event
    const fourth = connect(token);
    const errorPayload = await new Promise<{ code: string }>((resolve) => {
      fourth.on('error', resolve);
    });
    expect(errorPayload.code).toBe('DUPLICATE_CONNECTION');
  });
});
