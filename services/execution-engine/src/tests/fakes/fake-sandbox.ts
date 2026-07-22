import type {
  ContainerRunResult,
  ISandboxRunner,
  SandboxRunSpec,
} from '../../docker/sandbox.types.js';

/**
 * Scriptable in-memory sandbox. Because the execution service depends
 * on ISandboxRunner (not dockerode), the entire compile→run pipeline
 * is testable with zero Docker: queue up the results each `run()`
 * should return, in order.
 */
export class FakeSandbox implements ISandboxRunner {
  private queued: ContainerRunResult[] = [];
  public calls: SandboxRunSpec[] = [];

  script(...results: ContainerRunResult[]): this {
    this.queued.push(...results);
    return this;
  }

  async run(spec: SandboxRunSpec): Promise<ContainerRunResult> {
    this.calls.push(spec);
    const next = this.queued.shift();
    if (!next) throw new Error('FakeSandbox: no scripted result for this run()');
    return next;
  }
}

export function runResult(overrides: Partial<ContainerRunResult> = {}): ContainerRunResult {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    durationMs: 12,
    memoryUsedMb: 8,
    oomKilled: false,
    timedOut: false,
    truncated: false,
    ...overrides,
  };
}
