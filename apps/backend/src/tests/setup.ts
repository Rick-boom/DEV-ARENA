/**
 * Runs before any test file. Environment must be valid BEFORE
 * src/config/env.ts is imported anywhere, because validation happens
 * at module load (fail-fast by design).
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
