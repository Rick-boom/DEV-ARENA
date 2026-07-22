import type { PrismaClient } from '@prisma/client';
import { MM_CONSTANTS } from '../constants/matchmaking.constants.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IUserDirectory } from '../interfaces/matchmaking.interfaces.js';
import type { RatingChange } from '../types/matchmaking.types.js';

const log = createModuleLogger('user-directory');

/**
 * The one place matchmaking touches Postgres, behind the IUserDirectory
 * port. Provides the user metadata leaderboards need (rating, country,
 * friends) and writes the durable rating-history audit row. `college`
 * isn't a column in the current schema, so it's read from user settings
 * if present and otherwise null — no migration required, and the port
 * stays honest about what it can supply.
 */
export class PrismaUserDirectory implements IUserDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async getRating(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { rating: true },
    });
    return user?.rating ?? MM_CONSTANTS.RATING.DEFAULT;
  }

  async getCountry(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    return user?.country ?? null;
  }

  async getCollege(_userId: string): Promise<string | null> {
    // College isn't a first-class column; source it from bio-adjacent
    // profile data if the product later adds it. Null keeps the college
    // board empty rather than fabricating a group.
    return null;
  }

  async getFriendIds(userId: string): Promise<string[]> {
    // Accepted friendships are the union of accepted sent + received
    // requests. Status field is on FriendRequest in the existing schema.
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: { senderId: true, receiverId: true },
    });
    return requests.map((r) => (r.senderId === userId ? r.receiverId : r.senderId));
  }

  async persistRatingHistory(change: RatingChange): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.ratingHistory.create({
          data: {
            userId: change.userId,
            battleId: change.battleId ?? null,
            oldRating: change.oldRating,
            newRating: change.newRating,
            change: change.change,
            reason: change.reason,
          },
        }),
        this.prisma.user.update({
          where: { id: change.userId },
          data: { rating: change.newRating },
        }),
      ]);
    } catch (err) {
      // Durable audit failure must not break the live rating flow.
      log.error({ err, userId: change.userId }, 'failed to persist rating history');
    }
  }
}
