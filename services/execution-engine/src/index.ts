import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { createRedisConnection } from './queue/connection.js';
import { DeadLetterQueue } from './queue/dead-letter.queue.js';
import { DockerSandbox } from './docker/docker-sandbox.js';
import { WorkspaceService } from './services/workspace.service.js';
import { ExecutionService } from './services/execution.service.js';
import { createExecutionWorker } from './workers/execution.worker.js';

/**
 * Worker entry point. Composition root for the execution side: wires
 * the Docker sandbox + workspace + execution service into a BullMQ
 * worker. Scale throughput by running N copies of THIS process (each
 * its own container); they all pull from the same Redis queue.
 */
async function main(): Promise<void> {
  const workerConn = createRedisConnection();
  const dlqConn = createRedisConnection();

  const sandbox = new DockerSandbox();
  const workspace = new WorkspaceService();
  const service = new ExecutionService(sandbox, workspace);
  const deadLetters = new DeadLetterQueue(dlqConn);

  const worker = createExecutionWorker(workerConn, service, deadLetters);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'worker shutting down');
    await worker.close(); // stops taking new jobs, finishes in-flight
    await deadLetters.close();
    workerConn.disconnect();
    dlqConn.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'execution worker started');
}

main().catch((err) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
