/** Valid env before config/env.ts loads (fail-fast at import time). */
process.env.NODE_ENV = 'test';
process.env.PORT = '4100';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.MAX_CONNECTIONS_PER_USER = '3';
process.env.RATE_LIMIT_MAX_EVENTS = '50';
process.env.BATTLE_ROOM_CAPACITY = '2';
process.env.COLLAB_ROOM_CAPACITY = '4';
