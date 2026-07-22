import { RoomStatus, BattleStatus, type PrismaClient, type Prisma } from '@prisma/client';
import type { BattleWithRelations, IBattleRepository } from '../interfaces/battle.interfaces.js';

const INCLUDE = {
  room: { include: { participants: true } },
  participants: true,
} satisfies Prisma.BattleInclude;

/**
 * Durable persistence for battles. All multi-row writes that must be
 * consistent (create room+battle+host participant; finish battle +
 * rank participants) run inside a single interactive transaction, so a
 * crash can never leave a half-created battle.
 */
export class BattleRepository implements IBattleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createRoomWithBattle(input: {
    room: Prisma.RoomCreateInput;
    battle: Omit<Prisma.BattleCreateInput, 'room'>;
    hostId: string;
  }): Promise<BattleWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({ data: input.room });
      const battle = await tx.battle.create({
        data: { ...input.battle, room: { connect: { id: room.id } } },
      });
      // Host is the first room + battle participant.
      await tx.roomParticipant.create({ data: { roomId: room.id, userId: input.hostId } });
      await tx.battleParticipant.create({ data: { battleId: battle.id, userId: input.hostId } });
      return tx.battle.findUniqueOrThrow({ where: { id: battle.id }, include: INCLUDE });
    });
  }

  findById(battleId: string): Promise<BattleWithRelations | null> {
    return this.prisma.battle.findUnique({ where: { id: battleId }, include: INCLUDE });
  }

  async findByRoomCode(code: string): Promise<BattleWithRelations | null> {
    const room = await this.prisma.room.findUnique({
      where: { code },
      select: { battle: { select: { id: true } } },
    });
    if (!room?.battle) return null;
    return this.findById(room.battle.id);
  }

  async addParticipant(battleId: string, roomId: string, userId: string): Promise<void> {
    await this.prisma.$transaction([
      // Idempotent: unique (roomId,userId) / (battleId,userId) absorb races.
      this.prisma.roomParticipant.upsert({
        where: { roomId_userId: { roomId, userId } },
        create: { roomId, userId },
        update: { leftAt: null },
      }),
      this.prisma.battleParticipant.upsert({
        where: { battleId_userId: { battleId, userId } },
        create: { battleId, userId },
        update: {},
      }),
    ]);
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    await this.prisma.roomParticipant.updateMany({
      where: { roomId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });
  }

  async markStarted(battleId: string, startedAt: Date): Promise<void> {
    await this.prisma.battle.update({
      where: { id: battleId },
      data: { status: BattleStatus.IN_PROGRESS, startedAt },
    });
  }

  async finish(input: {
    battleId: string;
    winnerId: string | null;
    endedAt: Date;
    ranks: { userId: string; rank: number; score: number }[];
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.battle.update({
        where: { id: input.battleId },
        data: {
          status: BattleStatus.FINISHED,
          endedAt: input.endedAt,
          winner: input.winnerId ? { connect: { id: input.winnerId } } : { disconnect: true },
          room: { update: { status: RoomStatus.COMPLETED } },
        },
      });
      for (const r of input.ranks) {
        await tx.battleParticipant.update({
          where: { battleId_userId: { battleId: input.battleId, userId: r.userId } },
          data: { rank: r.rank, score: r.score },
        });
      }
    });
  }

  async abort(battleId: string): Promise<void> {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      select: { roomId: true },
    });
    if (!battle) return;
    await this.prisma.$transaction([
      this.prisma.battle.update({
        where: { id: battleId },
        data: { status: BattleStatus.ABORTED },
      }),
      this.prisma.room.update({
        where: { id: battle.roomId },
        data: { status: RoomStatus.CANCELLED },
      }),
    ]);
  }

  async listHistoryForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ rows: BattleWithRelations[]; total: number }> {
    const where: Prisma.BattleWhereInput = {
      participants: { some: { userId } },
      status: { in: ['FINISHED', 'ABORTED'] },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.battle.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.battle.count({ where }),
    ]);
    return { rows, total };
  }

  async recordRatingEvents(events: Prisma.RatingHistoryCreateManyInput[]): Promise<void> {
    if (events.length === 0) return;
    await this.prisma.ratingHistory.createMany({ data: events });
  }
}
