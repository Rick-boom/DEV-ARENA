import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('workspace');

/**
 * Owns the temporary working directory for a single submission. Each
 * job gets an isolated mkdtemp directory that holds only the source
 * file; it is bind-mounted read-only into the container and deleted in
 * a finally block no matter how the run ends. No persistent storage,
 * no cross-submission leakage.
 */
export class WorkspaceService {
  async create(sourceFilename: string, code: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'devarena-exec-'));
    await writeFile(join(dir, sourceFilename), code, { encoding: 'utf8', mode: 0o444 });
    log.debug({ dir }, 'workspace created');
    return dir;
  }

  async destroy(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
      log.debug({ dir }, 'workspace destroyed');
    } catch (err) {
      // Never throw from cleanup — log loudly so leaks are detectable.
      log.error({ err, dir }, 'workspace cleanup failed');
    }
  }
}
