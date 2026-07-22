import { RoomType, PresenceState } from '../types/domain.types.js';

/**
 * AsyncAPI 2.6 description of the Socket.IO event contract. Swagger/
 * OpenAPI describes request/response HTTP; a real-time service is
 * event-driven, so AsyncAPI is the correct schema format. This object
 * is served at /docs.json so tooling (AsyncAPI Studio, generators) can
 * render the event catalog. The HTTP /health surface is documented in
 * openapi.ts alongside it.
 */
export const asyncApiSpec = {
  asyncapi: '2.6.0',
  info: {
    title: 'DevArena — Real-Time Communication API',
    version: '1.0.0',
    description:
      'Socket.IO gateway (namespace /rt). JWT handshake auth; Redis-adapter horizontal scaling. Events below are the client<->server contract.',
  },
  servers: {
    production: { url: 'wss://rt.devarena.app/rt', protocol: 'wss' },
    local: { url: 'ws://localhost:4100/rt', protocol: 'ws' },
  },
  channels: {
    'room:create': {
      description: 'Create (or idempotently return) a room. Ack returns the room.',
      publish: {
        message: {
          payload: {
            type: 'object',
            required: ['type'],
            properties: {
              type: { type: 'string', enum: Object.values(RoomType) },
              roomId: { type: 'string', description: 'optional client-chosen id' },
            },
          },
        },
      },
    },
    'room:join': {
      description:
        'Join a room. Ack returns the room + current participants; other members receive room:user-joined.',
      publish: {
        message: {
          payload: {
            type: 'object',
            required: ['roomId'],
            properties: { roomId: { type: 'string' } },
          },
        },
      },
    },
    'room:leave': {
      description: 'Leave a room. Others receive room:user-left.',
      publish: {
        message: { payload: { type: 'object', properties: { roomId: { type: 'string' } } } },
      },
    },
    'room:delete': {
      description: 'Owner-only. Closes the room; all members receive room:closed.',
      publish: {
        message: { payload: { type: 'object', properties: { roomId: { type: 'string' } } } },
      },
    },
    'room:transfer-ownership': {
      description: 'Owner-only. Members receive room:ownership-changed.',
      publish: {
        message: {
          payload: {
            type: 'object',
            properties: { roomId: { type: 'string' }, toUserId: { type: 'string' } },
          },
        },
      },
    },
    'presence:update': {
      description: 'Update focus/state. Members receive presence:changed.',
      publish: {
        message: {
          payload: {
            type: 'object',
            properties: {
              roomId: { type: 'string' },
              focused: { type: 'boolean' },
              state: { type: 'string', enum: Object.values(PresenceState) },
            },
          },
        },
      },
    },
    'typing:start': {
      description: 'Members receive typing:changed {typing:true}.',
      publish: {
        message: { payload: { type: 'object', properties: { roomId: { type: 'string' } } } },
      },
    },
    'typing:stop': {
      description: 'Members receive typing:changed {typing:false}.',
      publish: {
        message: { payload: { type: 'object', properties: { roomId: { type: 'string' } } } },
      },
    },
    'cursor:update': {
      description: 'Replay-guarded (monotonic nonce). Members receive cursor:changed.',
      publish: {
        message: {
          payload: {
            type: 'object',
            required: ['roomId', 'cursor', 'nonce'],
            properties: {
              roomId: { type: 'string' },
              cursor: {
                type: 'object',
                properties: { line: { type: 'integer' }, column: { type: 'integer' } },
              },
              nonce: { type: 'integer', description: 'strictly increasing per socket' },
            },
          },
        },
      },
    },
    heartbeat: {
      description: 'App-level RTT probe. Ack returns { ts }.',
      publish: { message: { payload: { type: 'null' } } },
    },
  },
  components: {
    securitySchemes: {
      jwt: {
        type: 'httpApiKey',
        in: 'user',
        name: 'auth.token',
        description: 'JWT access token in the Socket.IO handshake auth field',
      },
    },
  },
} as const;
