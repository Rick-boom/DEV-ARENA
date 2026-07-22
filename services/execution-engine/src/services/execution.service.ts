import { getLanguageProfile } from '../constants/languages.js';
import { createModuleLogger } from '../utils/logger.js';
import { ExecutionStatus } from '../types/execution.types.js';
import type { ExecutionJobData, ExecutionResult } from '../types/execution.types.js';
import type { ISandboxRunner } from '../docker/sandbox.types.js';
import type { WorkspaceService } from './workspace.service.js';

const log = createModuleLogger('execution-service');

/**
 * Orchestrates one submission end-to-end, independent of Docker and of
 * the queue (both are injected). The full flow the spec describes —
 * validate → temp dir → write source → compile → execute → capture →
 * destroy → classify — lives here as a single, testable method.
 *
 * Verdict classification is centralized so every exit path maps to
 * exactly one of the seven supported statuses.
 */
export class ExecutionService {
  constructor(
    private readonly sandbox: ISandboxRunner,
    private readonly workspace: WorkspaceService,
  ) {}

  async execute(job: ExecutionJobData): Promise<ExecutionResult> {
    const profile = getLanguageProfile(job.language);
    const dir = await this.workspace.create(profile.source, job.code);

    try {
      // ── compile (compiled languages only) ──────────────────────
      if (profile.compile) {
        const compile = await this.sandbox.run({
          image: profile.image,
          argv: profile.compile,
          workdir: dir,
          stdin: '',
          timeoutMs: job.limits.compileMs,
          limits: job.limits,
        });

        if (compile.timedOut) {
          return this.result(ExecutionStatus.COMPILATION_ERROR, {
            stderr: `Compilation timed out after ${job.limits.compileMs}ms`,
            executionTimeMs: compile.durationMs,
          });
        }
        if (compile.exitCode !== 0) {
          return this.result(ExecutionStatus.COMPILATION_ERROR, {
            stdout: compile.stdout,
            stderr: compile.stderr,
            exitCode: compile.exitCode,
            executionTimeMs: compile.durationMs,
            truncated: compile.truncated,
          });
        }
      }

      // ── execute ────────────────────────────────────────────────
      // For compiled languages the binary now lives in the (read-only)
      // workspace; the run command references it via the same mount.
      const run = await this.sandbox.run({
        image: profile.image,
        argv: profile.run,
        workdir: dir,
        stdin: job.input,
        timeoutMs: job.limits.timeLimitMs,
        limits: job.limits,
      });

      return this.classify(run, job);
    } catch (err) {
      log.error({ err, language: job.language }, 'execution failed');
      return this.result(ExecutionStatus.INTERNAL_ERROR, {
        stderr: 'Internal execution error',
      });
    } finally {
      await this.workspace.destroy(dir);
    }
  }

  /** Maps a raw container run to one of the seven terminal verdicts. */
  private classify(
    run: {
      stdout: string;
      stderr: string;
      exitCode: number | null;
      durationMs: number;
      memoryUsedMb: number;
      oomKilled: boolean;
      timedOut: boolean;
      truncated: boolean;
    },
    job: ExecutionJobData,
  ): ExecutionResult {
    const base = {
      stdout: run.stdout,
      stderr: run.stderr,
      exitCode: run.exitCode,
      executionTimeMs: run.durationMs,
      memoryUsedMb: run.memoryUsedMb,
      truncated: run.truncated,
    };

    // Order matters: OOM and timeout can co-occur with a non-zero exit;
    // report the root cause, not the symptom.
    if (run.oomKilled) {
      return { ...base, status: ExecutionStatus.MEMORY_LIMIT_EXCEEDED };
    }
    if (run.timedOut) {
      return { ...base, status: ExecutionStatus.TIME_LIMIT_EXCEEDED };
    }
    if (run.truncated) {
      return { ...base, status: ExecutionStatus.OUTPUT_LIMIT_EXCEEDED };
    }
    if (run.exitCode !== 0) {
      return { ...base, status: ExecutionStatus.RUNTIME_ERROR };
    }
    void job;
    return { ...base, status: ExecutionStatus.ACCEPTED };
  }

  private result(status: ExecutionStatus, partial: Partial<ExecutionResult>): ExecutionResult {
    return {
      status,
      stdout: partial.stdout ?? '',
      stderr: partial.stderr ?? '',
      exitCode: partial.exitCode ?? null,
      executionTimeMs: partial.executionTimeMs ?? 0,
      memoryUsedMb: partial.memoryUsedMb ?? 0,
      truncated: partial.truncated ?? false,
    };
  }
}
