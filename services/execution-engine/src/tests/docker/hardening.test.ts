import { describe, expect, it, vi } from 'vitest';
import type Docker from 'dockerode';
import { DockerSandbox } from '../../docker/docker-sandbox.js';
import type { SandboxRunSpec } from '../../docker/sandbox.types.js';

/** Minimal shape of the createContainer arg we assert against. */
interface CreatedContainerConfig {
  NetworkDisabled?: boolean;
  User?: string;
  HostConfig: {
    NetworkMode?: string;
    ReadonlyRootfs?: boolean;
    Binds?: string[];
    Tmpfs?: Record<string, string>;
    NanoCpus?: number;
    Memory?: number;
    MemorySwap?: number;
    MemorySwappiness?: number;
    PidsLimit?: number;
    CapDrop?: string[];
    SecurityOpt?: string[];
  };
}

/**
 * "Docker tests" without a live daemon: we inject a mock dockerode and
 * assert the CONTAINER IS CREATED LOCKED-DOWN. These lock in the
 * security contract — a regression that drops network isolation or
 * raises a limit fails here, loudly.
 */
function mockDocker() {
  const createContainer = vi.fn();
  const container = {
    id: 'abcdef123456',
    attach: vi.fn().mockResolvedValue({ write: vi.fn(), end: vi.fn() }),
    start: vi.fn().mockResolvedValue(undefined),
    wait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
    inspect: vi.fn().mockResolvedValue({ State: { OOMKilled: false } }),
    stats: vi.fn().mockResolvedValue({ memory_stats: { max_usage: 8 * 1024 * 1024 } }),
    kill: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  createContainer.mockResolvedValue(container);
  const docker = {
    createContainer,
    modem: { demuxStream: vi.fn() },
  } as unknown as Docker;
  return { docker, createContainer, container };
}

const spec: SandboxRunSpec = {
  image: 'devarena/exec-python:latest',
  argv: ['python3', 'main.py'],
  workdir: '/tmp/devarena-exec-xyz',
  stdin: '',
  timeoutMs: 2000,
  limits: {
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    compileMs: 15000,
    cpuCores: 1,
    pids: 64,
    outputBytes: 1_048_576,
    tmpfsMb: 32,
  },
};

describe('DockerSandbox hardening', () => {
  it('creates a container with every isolation control enabled', async () => {
    const { docker, createContainer } = mockDocker();
    const sandbox = new DockerSandbox(docker);
    await sandbox.run(spec);

    const cfg = createContainer.mock.calls[0]![0] as CreatedContainerConfig;
    const host = cfg.HostConfig;

    // network fully disabled
    expect(cfg.NetworkDisabled).toBe(true);
    expect(host.NetworkMode).toBe('none');
    // filesystem read-only + source mounted read-only
    expect(host.ReadonlyRootfs).toBe(true);
    expect(host.Binds).toContain('/tmp/devarena-exec-xyz:/sandbox:ro');
    // only writable path is an in-memory, noexec tmpfs
    expect(host.Tmpfs!['/tmp']).toContain('noexec');
    expect(host.Tmpfs!['/tmp']).toContain('size=32m');
    // never root
    expect(cfg.User).toBe('65534:65534');
    // no capabilities, no privilege escalation
    expect(host.CapDrop).toContain('ALL');
    expect(host.SecurityOpt).toContain('no-new-privileges');
  });

  it('translates resource limits into the correct cgroup settings', async () => {
    const { docker, createContainer } = mockDocker();
    await new DockerSandbox(docker).run(spec);
    const host = (createContainer.mock.calls[0]![0] as CreatedContainerConfig).HostConfig;

    expect(host.NanoCpus).toBe(1e9); // 1 core
    expect(host.Memory).toBe(256 * 1024 * 1024);
    expect(host.MemorySwap).toBe(host.Memory); // swap disabled
    expect(host.MemorySwappiness).toBe(0);
    expect(host.PidsLimit).toBe(64); // fork-bomb containment
  });

  it('always removes the container, even on a clean run', async () => {
    const { docker, container } = mockDocker();
    await new DockerSandbox(docker).run(spec);
    expect(container.remove).toHaveBeenCalledWith({ force: true });
  });

  it('reports timedOut and force-kills when the watchdog fires', async () => {
    const { docker, container } = mockDocker();
    // Make wait() hang past the timeout so the watchdog wins.
    container.wait.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ StatusCode: 137 }), 50)),
    );
    const result = await new DockerSandbox(docker).run({ ...spec, timeoutMs: 10 });
    expect(result.timedOut).toBe(true);
    expect(container.kill).toHaveBeenCalled();
  });
});
