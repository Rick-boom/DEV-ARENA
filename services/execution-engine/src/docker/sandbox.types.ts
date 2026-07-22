import type { ExecutionJobData } from '../types/execution.types.js';

/** Low-level result of running one argv inside a fresh container. */
export interface ContainerRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  /** wall-clock duration of the container run, ms */
  durationMs: number;
  /** peak memory observed via cgroup, MB (0 if unavailable) */
  memoryUsedMb: number;
  /** Docker reported the container was OOM-killed */
  oomKilled: boolean;
  /** the run was terminated by our timeout watchdog */
  timedOut: boolean;
  /** stdout/stderr hit the output ceiling and were cut */
  truncated: boolean;
}

/** Everything the sandbox needs to run one argv. */
export interface SandboxRunSpec {
  image: string;
  argv: string[];
  /** host directory bind-mounted read-only at /sandbox */
  workdir: string;
  stdin: string;
  timeoutMs: number;
  limits: ExecutionJobData['limits'];
}

/**
 * Abstraction over "run one command in a throwaway sandbox". The
 * service layer depends on this interface, not on dockerode — so the
 * runner is swappable (gVisor, Firecracker, a fake in tests) without
 * touching business logic (Dependency Inversion).
 */
export interface ISandboxRunner {
  run(spec: SandboxRunSpec): Promise<ContainerRunResult>;
}
