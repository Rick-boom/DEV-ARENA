import { describe, expect, it, beforeEach } from 'vitest';
import { ExecutionService } from '../../services/execution.service.js';
import { WorkspaceService } from '../../services/workspace.service.js';
import { ExecutionStatus } from '../../types/execution.types.js';
import type { ExecutionJobData } from '../../types/execution.types.js';
import { FakeSandbox, runResult } from '../fakes/fake-sandbox.js';

/**
 * Full compile→run→classify pipeline against a scripted sandbox and a
 * real (temp-dir) workspace. Verifies every terminal verdict maps
 * correctly and that compiled vs interpreted languages run the right
 * number of container passes.
 */
const LIMITS: ExecutionJobData['limits'] = {
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  compileMs: 15000,
  cpuCores: 1,
  pids: 64,
  outputBytes: 1_048_576,
  tmpfsMb: 32,
};

function job(overrides: Partial<ExecutionJobData> = {}): ExecutionJobData {
  return {
    language: 'python',
    code: 'print(1)',
    input: '',
    limits: LIMITS,
    submittedAt: Date.now(),
    ...overrides,
  };
}

describe('ExecutionService', () => {
  let workspace: WorkspaceService;

  beforeEach(() => {
    workspace = new WorkspaceService();
  });

  describe('interpreted languages (no compile pass)', () => {
    it('returns ACCEPTED on clean exit 0 and runs exactly one container', async () => {
      const sandbox = new FakeSandbox().script(runResult({ stdout: '1\n', exitCode: 0 }));
      const service = new ExecutionService(sandbox, workspace);
      const result = await service.execute(job());
      expect(result.status).toBe(ExecutionStatus.ACCEPTED);
      expect(result.stdout).toBe('1\n');
      expect(sandbox.calls).toHaveLength(1); // no compile pass for python
    });

    it('classifies a non-zero exit as RUNTIME_ERROR', async () => {
      const sandbox = new FakeSandbox().script(runResult({ exitCode: 1, stderr: 'Traceback…' }));
      const service = new ExecutionService(sandbox, workspace);
      expect((await service.execute(job())).status).toBe(ExecutionStatus.RUNTIME_ERROR);
    });

    it('classifies a watchdog kill as TIME_LIMIT_EXCEEDED', async () => {
      const sandbox = new FakeSandbox().script(runResult({ timedOut: true, exitCode: null }));
      const service = new ExecutionService(sandbox, workspace);
      expect((await service.execute(job())).status).toBe(ExecutionStatus.TIME_LIMIT_EXCEEDED);
    });

    it('classifies an OOM kill as MEMORY_LIMIT_EXCEEDED (even with a non-zero exit)', async () => {
      const sandbox = new FakeSandbox().script(runResult({ oomKilled: true, exitCode: 137 }));
      const service = new ExecutionService(sandbox, workspace);
      expect((await service.execute(job())).status).toBe(ExecutionStatus.MEMORY_LIMIT_EXCEEDED);
    });

    it('classifies truncated output as OUTPUT_LIMIT_EXCEEDED', async () => {
      const sandbox = new FakeSandbox().script(runResult({ truncated: true, exitCode: 0 }));
      const service = new ExecutionService(sandbox, workspace);
      expect((await service.execute(job())).status).toBe(ExecutionStatus.OUTPUT_LIMIT_EXCEEDED);
    });
  });

  describe('compiled languages (compile then run)', () => {
    it('runs two containers and returns ACCEPTED when both succeed', async () => {
      const sandbox = new FakeSandbox().script(
        runResult({ exitCode: 0 }), // compile
        runResult({ stdout: '3\n', exitCode: 0 }), // run
      );
      const service = new ExecutionService(sandbox, workspace);
      const result = await service.execute(job({ language: 'cpp', code: 'int main(){}' }));
      expect(result.status).toBe(ExecutionStatus.ACCEPTED);
      expect(sandbox.calls).toHaveLength(2);
      // First call is the compiler argv.
      expect(sandbox.calls[0]?.argv[0]).toBe('g++');
    });

    it('returns COMPILATION_ERROR and never runs the program on compile failure', async () => {
      const sandbox = new FakeSandbox().script(
        runResult({ exitCode: 1, stderr: 'error: expected ;' }),
      );
      const service = new ExecutionService(sandbox, workspace);
      const result = await service.execute(job({ language: 'cpp', code: 'bad' }));
      expect(result.status).toBe(ExecutionStatus.COMPILATION_ERROR);
      expect(result.stderr).toContain('expected');
      expect(sandbox.calls).toHaveLength(1); // compile only, run skipped
    });

    it('treats a compile timeout as COMPILATION_ERROR', async () => {
      const sandbox = new FakeSandbox().script(runResult({ timedOut: true, exitCode: null }));
      const service = new ExecutionService(sandbox, workspace);
      const result = await service.execute(job({ language: 'java', code: 'class Main{}' }));
      expect(result.status).toBe(ExecutionStatus.COMPILATION_ERROR);
      expect(sandbox.calls).toHaveLength(1);
    });
  });

  describe('resilience', () => {
    it('returns INTERNAL_ERROR (never throws) when the sandbox blows up', async () => {
      const sandbox = new FakeSandbox(); // empty script → run() throws
      const service = new ExecutionService(sandbox, workspace);
      const result = await service.execute(job());
      expect(result.status).toBe(ExecutionStatus.INTERNAL_ERROR);
    });
  });
});
