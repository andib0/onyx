import { prisma } from '../config/database.js';

export class FoodsService {
  async search(query: string, limit = 50) {
    return prisma.food.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: [
        { isVerified: 'desc' },
        { name: 'asc' },
      ],
      take: limit,
    });
  }

  async getById(id: string) {
    return prisma.food.findUnique({ where: { id } });
  }

  async create(data: {
    name: string;
    brand?: string;
    caloriesPer100g?: number;
    proteinPer100g?: number;
    carbsPer100g?: number;
    fatPer100g?: number;
    fiberPer100g?: number;
    sugarPer100g?: number;
    sodiumMgPer100g?: number;
  }) {
    return prisma.food.create({ data });
  }
}

export const foodsService = new FoodsService();
