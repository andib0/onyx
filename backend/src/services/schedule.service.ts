import { prisma } from '../config/database.js';

export class ScheduleService {
  async getBlocks(userId: string) {
    return prisma.scheduleBlock.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { start: 'asc' }],
    });
  }

  async createBlock(userId: string, data: {
    start: string;
    end: string;
    title: string;
    purpose?: string;
    good?: string;
    tag?: string;
    readonly?: boolean;
    source?: string;
    sortOrder?: number;
  }) {
    return prisma.scheduleBlock.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async updateBlock(userId: string, blockId: string, data: {
    start?: string;
    end?: string;
    title?: string;
    purpose?: string;
    good?: string;
    tag?: string;
    readonly?: boolean;
    source?: string;
    sortOrder?: number;
  }) {
    return prisma.scheduleBlock.update({
      where: { id: blockId, userId },
      data,
    });
  }

  async deleteBlock(userId: string, blockId: string) {
    return prisma.scheduleBlock.delete({
      where: { id: blockId, userId },
    });
  }

  // Completions
  async getCompletions(userId: string, date: string) {
    return prisma.completion.findMany({
      where: { userId, date },
    });
  }

  async toggleCompletion(userId: string, blockId: string, date: string, isComplete: boolean) {
    return prisma.completion.upsert({
      where: {
        userId_blockId_date: { userId, blockId, date },
      },
      create: {
        userId,
        blockId,
        date,
        isComplete,
        completedAt: isComplete ? new Date() : null,
      },
      update: {
        isComplete,
        completedAt: isComplete ? new Date() : null,
      },
    });
  }
}

export const scheduleService = new ScheduleService();
