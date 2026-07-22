import Docker from 'dockerode';
import { Writable, type Duplex } from 'node:stream';
import { env } from '../config/env.js';
import { createModuleLogger } from '../utils/logger.js';
import { ContainerError } from '../errors/execution-error.js';
import type { ContainerRunResult, ISandboxRunner, SandboxRunSpec } from './sandbox.types.js';

const log = createModuleLogger('docker-sandbox');

/**
 * The security boundary of the whole platform. Every argv runs in a
 * brand-new container that is created locked-down and destroyed
 * immediately after. Hardening applied to EVERY container:
 *
 *   • NetworkMode 'none'         — no network, period.
 *   • ReadonlyRootfs true        — root filesystem cannot be written.
 *   • /sandbox mounted read-only — user source is immutable at runtime.
 *   • tmpfs /tmp (size-capped)   — the only writable path, in memory,
 *                                  noexec/nosuid, wiped with the container.
 *   • CpuQuota / CpuPeriod       — hard CPU ceiling (fractional cores).
 *   • Memory + MemorySwap equal  — real memory cap, swap disabled, so
 *                                  overuse is an OOM kill (→ MLE), not
 *                                  silent host swapping.
 *   • PidsLimit                  — fork-bomb containment.
 *   • CapDrop ALL + no-new-privs — zero Linux capabilities, no escalation.
 *   • user 65534 (nobody)        — never root inside the container.
 *   • AutoRemove + explicit kill — no persistent containers, ever.
 *
 * A wall-clock watchdog kills runaway/infinite-loop containers even if
 * the in-container process ignores signals.
 */
export class DockerSandbox implements ISandboxRunner {
  private readonly docker: Docker;

  constructor(docker?: Docker) {
    this.docker = docker ?? new Docker({ socketPath: env.DOCKER_SOCKET_PATH });
  }

  async run(spec: SandboxRunSpec): Promise<ContainerRunResult> {
    const container = await this.createHardenedContainer(spec);
    const id = container.id.slice(0, 12);
    let timedOut = false;
    let watchdog: NodeJS.Timeout | undefined;

    try {
      const stream = (await container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
        hijack: true,
      })) as Duplex;

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let outBytes = 0;
      let truncated = false;
      const ceiling = spec.limits.outputBytes;

      // Docker multiplexes stdout/stderr on one stream; demux it.
      this.docker.modem.demuxStream(
        stream,
        writable((chunk) => {
          outBytes += chunk.length;
          if (outBytes <= ceiling) stdoutChunks.push(chunk);
          else truncated = true;
        }),
        writable((chunk) => {
          outBytes += chunk.length;
          if (outBytes <= ceiling) stderrChunks.push(chunk);
          else truncated = true;
        }),
      );

      const started = Date.now();
      await container.start();

      // Feed stdin, then close the write side so the program sees EOF.
      if (spec.stdin) stream.write(spec.stdin);
      stream.end();

      // Wall-clock watchdog: kill the container if it overruns.
      watchdog = setTimeout(() => {
        timedOut = true;
        container.kill({ signal: 'SIGKILL' }).catch(() => undefined);
      }, spec.timeoutMs);

      const waitResult = (await container.wait()) as { StatusCode: number };
      clearTimeout(watchdog);
      const durationMs = Date.now() - started;

      const inspect = await container.inspect().catch(() => null);
      const oomKilled = inspect?.State?.OOMKilled ?? false;
      const memoryUsedMb = await this.peakMemoryMb(container).catch(() => 0);

      return {
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode: timedOut ? null : waitResult.StatusCode,
        durationMs,
        memoryUsedMb,
        oomKilled,
        timedOut,
        truncated,
      };
    } catch (err) {
      log.error({ err, container: id }, 'container run failed');
      throw new ContainerError('Failed to run sandbox container', {
        cause: (err as Error).message,
      });
    } finally {
      if (watchdog) clearTimeout(watchdog);
      // Belt-and-suspenders: force removal even if AutoRemove lagged.
      await container.remove({ force: true }).catch(() => undefined);
    }
  }

  private async createHardenedContainer(spec: SandboxRunSpec): Promise<Docker.Container> {
    const nanoCpus = Math.round(spec.limits.cpuCores * 1e9);
    const memoryBytes = spec.limits.memoryLimitMb * 1024 * 1024;

    return this.docker.createContainer({
      Image: spec.image,
      Cmd: spec.argv,
      WorkingDir: '/sandbox',
      User: '65534:65534', // nobody:nogroup
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: true,
      StdinOnce: true,
      NetworkDisabled: true,
      Env: ['HOME=/tmp'],
      HostConfig: {
        AutoRemove: false, // we remove explicitly to read exit state first
        NetworkMode: 'none',
        ReadonlyRootfs: true,
        Binds: [`${spec.workdir}:/sandbox:ro`],
        Tmpfs: {
          '/tmp': `rw,noexec,nosuid,size=${spec.limits.tmpfsMb}m`,
        },
        NanoCpus: nanoCpus,
        Memory: memoryBytes,
        MemorySwap: memoryBytes, // == Memory disables swap
        MemorySwappiness: 0,
        PidsLimit: spec.limits.pids,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        Ulimits: [
          { Name: 'nofile', Soft: 256, Hard: 256 },
          { Name: 'fsize', Soft: 16 * 1024 * 1024, Hard: 16 * 1024 * 1024 },
        ],
      },
    });
  }

  private async peakMemoryMb(container: Docker.Container): Promise<number> {
    // One-shot (non-streaming) stats read; best-effort.
    const stats = (await container.stats({ stream: false })) as unknown as {
      memory_stats?: { max_usage?: number; usage?: number };
    };
    const bytes = stats.memory_stats?.max_usage ?? stats.memory_stats?.usage ?? 0;
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  }
}

/** Tiny writable sink so we can demux without importing stream boilerplate everywhere. */
function writable(onData: (chunk: Buffer) => void): NodeJS.WritableStream {
  return new Writable({
    write(chunk: Buffer, _enc, cb) {
      onData(chunk);
      cb();
    },
  });
}
