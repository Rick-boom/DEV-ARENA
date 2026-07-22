import type { Language } from '@prisma/client';
import { createModuleLogger } from '../../../lib/logger.js';
import { ExecutionUnavailableError } from '../errors/judge-error.js';
import type { IExecutionEngine } from '../interfaces/judge.interfaces.js';
import type { ExecutionOutcome } from '../types/judge.types.js';

const log = createModuleLogger('http-execution-engine');

/**
 * IExecutionEngine over HTTP to the (assumed, already-built) Execution
 * Engine service. The judge depends on the IExecutionEngine port, so
 * this concrete adapter is swappable and replaced by a fake in tests
 * (we can't run Docker/the engine in CI). A short timeout + typed
 * ExecutionUnavailable keeps a slow engine from stalling a judge worker.
 */
export class HttpExecutionEngineAdapter implements IExecutionEngine {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async run(input: {
    language: Language;
    code: string;
    stdin: string;
    timeLimitMs: number;
    memoryLimitMb: number;
  }): Promise<ExecutionOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: input.language.toLowerCase(),
          code: input.code,
          stdin: input.stdin,
          limits: { timeoutMs: input.timeLimitMs, memoryMb: input.memoryLimitMb },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        log.error({ status: res.status }, 'execution engine non-200');
        throw new ExecutionUnavailableError();
      }
      const body = (await res.json()) as ExecutionEnginePayload;
      return this.toOutcome(body);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw new ExecutionUnavailableError();
      if (err instanceof ExecutionUnavailableError) throw err;
      log.error({ err }, 'execution engine request failed');
      throw new ExecutionUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  }

  private toOutcome(p: ExecutionEnginePayload): ExecutionOutcome {
    return {
      stdout: p.stdout ?? '',
      stderr: p.stderr ?? '',
      exitCode: p.exitCode ?? null,
      durationMs: p.durationMs ?? 0,
      memoryUsedMb: p.memoryUsedMb ?? 0,
      oomKilled: p.oomKilled ?? false,
      timedOut: p.timedOut ?? false,
      truncated: p.truncated ?? false,
      compileError: p.compileError ?? undefined,
    };
  }
}

interface ExecutionEnginePayload {
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  durationMs?: number;
  memoryUsedMb?: number;
  oomKilled?: boolean;
  timedOut?: boolean;
  truncated?: boolean;
  compileError?: string;
}
