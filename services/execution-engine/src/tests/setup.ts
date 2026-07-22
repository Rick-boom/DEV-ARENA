/** Valid env before config/env.ts loads (fail-fast validation at import). */
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MAX_EXECUTION_MS = '5000';
process.env.MAX_MEMORY_MB = '256';
process.env.MAX_COMPILE_MS = '15000';
