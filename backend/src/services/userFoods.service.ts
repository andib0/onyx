import { prisma } from '../config/database.js';
import { assertNotTombstoned, deleteStamp, recordTombstones } from './sync/tombstones.js';

export class UserFoodsService {
  async list(userId: string) {
    return prisma.userFood.findMany({
      where: { userId },
      include: { food: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Idempotent on (user, food); a client `id` is used when the row is new.
   *  410 when that `id` was deleted (saving the food again needs a new id). */
  async add(userId: string, foodId: string, id?: string) {
    await assertNotTombstoned(userId, 'userFood', id);
    return prisma.userFood.upsert({
      where: { userId_foodId: { userId, foodId } },
      update: {},
      create: { id, userId, foodId },
      include: { food: true },
    });
  }

  async remove(userId: string, id: string, hlc?: string) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.userFood.deleteMany({ where: { id, userId } });
      if (result.count > 0)
        await recordTombstones(
          tx,
          userId,
          [{ entity: 'userFood', entityId: id }],
          deleteStamp(hlc)
        );
      return result;
    });
  }
}

export const userFoodsService = new UserFoodsService();
