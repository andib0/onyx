import { prisma } from '../config/database.js';

export class SupplementDbService {
  async search(query: string, limit = 50) {
    return prisma.supplementDatabase.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: [{ name: 'asc' }],
      take: limit,
    });
  }

  async list(limit = 50) {
    return prisma.supplementDatabase.findMany({
      orderBy: [{ name: 'asc' }],
      take: limit,
    });
  }
}

export const supplementDbService = new SupplementDbService();
