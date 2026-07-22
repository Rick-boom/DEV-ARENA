import type { PrismaClient } from '@prisma/client';
import type { IAuditLogRepository } from '../interfaces/problem.interfaces.js';
import { createModuleLogger } from '../../../lib/logger.js';

const log = createModuleLogger('audit-log');

/**
 * Writes to the immutable AdminLog table. Failure to audit must never
 * fail the admin's action (availability over audit completeness) — but
 * it IS logged loudly so missing audit rows are detectable.
 */
export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(entry: {
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.adminLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          metadata: (entry.metadata ?? {}) as object,
        },
      });
    } catch (err) {
      log.error({ err, entry }, 'AUDIT WRITE FAILED');
    }
  }
}
