import { prisma } from '../config/database.js';

export class UserFoodsService {
  async list(userId: string) {
    return prisma.userFood.findMany({
      where: { userId },
      include: { food: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(userId: string, foodId: string) {
    return prisma.userFood.upsert({
      where: { userId_foodId: { userId, foodId } },
      update: {},
      create: { userId, foodId },
      include: { food: true },
    });
  }

  async remove(userId: string, id: string) {
    return prisma.userFood.deleteMany({ where: { id, userId } });
  }
}

export const userFoodsService = new UserFoodsService();
