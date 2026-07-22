import { env } from '../config/env.js';
import type { ExecutionJobData, ExecutionRequest } from '../types/execution.types.js';

/**
 * Resolves the effective resource limits for a request. Core security
 * rule: a request may only TIGHTEN a ceiling, never raise it above the
 * service maximum. This is enforced with Math.min so a malicious
 * client sending timeLimitMs=999999 still gets clamped to the max.
 */
export function resolveLimits(req: ExecutionRequest): ExecutionJobData['limits'] {
  const timeLimitMs = Math.min(req.timeLimitMs ?? env.MAX_EXECUTION_MS, env.MAX_EXECUTION_MS);
  const memoryLimitMb = Math.min(req.memoryLimitMb ?? env.MAX_MEMORY_MB, env.MAX_MEMORY_MB);
  return {
    timeLimitMs,
    memoryLimitMb,
    compileMs: env.MAX_COMPILE_MS,
    cpuCores: env.MAX_CPU_CORES,
    pids: env.MAX_PIDS,
    outputBytes: env.MAX_OUTPUT_BYTES,
    tmpfsMb: env.MAX_TMPFS_MB,
  };
}
