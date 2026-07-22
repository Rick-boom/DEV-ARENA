import { PrismaClient } from '@prisma/client';

/**
 * One PrismaClient per process. Prisma manages its own pool; creating
 * multiple clients exhausts Postgres connections under load.
 */
export const prisma = new PrismaClient();
