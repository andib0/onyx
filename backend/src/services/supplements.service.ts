import { prisma } from '../config/database.js';

export class SupplementsService {
  async getSupplements(userId: string) {
    return prisma.supplement.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { timeAt: 'asc' }],
    });
  }

  async createSupplement(userId: string, data: {
    item: string;
    goal: string;
    dose: string;
    tier?: string;
    rule?: string;
    timeAt?: string;
    sortOrder?: number;
  }) {
    return prisma.supplement.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async updateSupplement(userId: string, supplementId: string, data: {
    item?: string;
    goal?: string;
    dose?: string;
    tier?: string;
    rule?: string;
    timeAt?: string;
    sortOrder?: number;
  }) {
    return prisma.supplement.update({
      where: { id: supplementId, userId },
      data,
    });
  }

  async deleteSupplement(userId: string, supplementId: string) {
    return prisma.supplement.delete({
      where: { id: supplementId, userId },
    });
  }

  // Logs
  async getLogs(userId: string, startDate?: string, endDate?: string) {
    const where: { userId: string; date?: { gte?: string; lte?: string } } = { userId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }
    return prisma.supplementLog.findMany({
      where,
      include: { supplement: true },
      orderBy: { date: 'desc' },
    });
  }

  async toggleLog(userId: string, supplementId: string, date: string, isTaken: boolean) {
    return prisma.supplementLog.upsert({
      where: {
        userId_supplementId_date: { userId, supplementId, date },
      },
      create: {
        userId,
        supplementId,
        date,
        isTaken,
        takenAt: isTaken ? new Date() : null,
      },
      update: {
        isTaken,
        takenAt: isTaken ? new Date() : null,
      },
    });
  }
}

export const supplementsService = new SupplementsService();
