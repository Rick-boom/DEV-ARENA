import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';

/**
 * AI service bootstrap. Runs as an internal service (never exposed
 * publicly) so the Gemini key and prompt templates stay off the main
 * API surface. Only /health exists in the foundation.
 */
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', geminiConfigured: Boolean(env.GEMINI_API_KEY) },
  });
});

const server = app.listen(env.PORT, () => {
  console.log(`[ai-service] listening on :${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  console.log(`[ai-service] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
