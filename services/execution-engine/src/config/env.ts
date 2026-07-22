import { z } from 'zod';
import { validateEnv, envField } from '@devarena/shared-utils';

/**
 * Fail-fast configuration for the execution service. Both the API
 * process and the worker process load this same schema, so a
 * misconfigured limit crashes on boot rather than mid-submission.
 */
const schema = z.object({
  NODE_ENV: envField.nodeEnv,
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  REDIS_URL: envField.url,
  EXECUTION_QUEUE_NAME: envField.nonEmpty.default('code-execution'),
  DEAD_LETTER_QUEUE_NAME: envField.nonEmpty.default('code-execution-dlq'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),

  // Docker
  DOCKER_SOCKET_PATH: envField.nonEmpty.default('/var/run/docker.sock'),

  // Default resource ceilings (a request may lower, never raise, these)
  MAX_CPU_CORES: z.coerce.number().min(0.1).max(4).default(1),
  MAX_MEMORY_MB: z.coerce.number().int().min(16).max(1024).default(256),
  MAX_EXECUTION_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),
  MAX_COMPILE_MS: z.coerce.number().int().min(1_000).max(60_000).default(15_000),
  MAX_PIDS: z.coerce.number().int().min(8).max(512).default(64),
  MAX_OUTPUT_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(1_048_576),
  MAX_TMPFS_MB: z.coerce.number().int().min(4).max(256).default(32),

  // Queue admission control (QueueFull guard)
  MAX_QUEUE_DEPTH: z.coerce.number().int().min(1).default(10_000),
});

export const env = validateEnv(schema, process.env);
export type Env = typeof env;
