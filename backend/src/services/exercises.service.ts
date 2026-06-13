import { prisma } from '../config/database.js';

export class ExercisesService {
  async search(query: string, limit = 20) {
    const q = query.trim();
    return prisma.exerciseLibrary.findMany({
      where: q
        ? { name: { contains: q, mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
      take: limit,
    });
  }
}

export const exercisesService = new ExercisesService();
