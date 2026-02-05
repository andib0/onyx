import { prisma } from '../config/database.js';

export class ProgramsService {
  async listPrograms(userId: string) {
    return prisma.gymProgram.findMany({
      where: {
        OR: [{ isSystem: true }, { userId }],
      },
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        isSystem: true,
        userId: true,
        days: {
          select: {
            id: true,
            name: true,
            dayOrder: true,
          },
          orderBy: { dayOrder: 'asc' },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async getProgram(programId: string, userId: string) {
    return prisma.gymProgram.findFirst({
      where: {
        id: programId,
        OR: [{ isSystem: true }, { userId }],
      },
      include: {
        days: {
          orderBy: { dayOrder: 'asc' },
          include: {
            exercises: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }
}

export const programsService = new ProgramsService();
