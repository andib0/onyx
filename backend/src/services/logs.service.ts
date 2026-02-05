import { prisma } from '../config/database.js';

export class LogsService {
  async getLogs(userId: string, startDate?: string, endDate?: string) {
    const where: { userId: string; date?: { gte?: string; lte?: string } } = { userId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return prisma.dailyLog.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getLog(userId: string, date: string) {
    return prisma.dailyLog.findUnique({
      where: {
        userId_date: { userId, date },
      },
    });
  }

  async createOrUpdateLog(userId: string, data: {
    date: string;
    day?: string;
    bw?: string;
    sleep?: string;
    steps?: string;
    top?: string;
    notes?: string;
  }) {
    const { date, ...logData } = data;
    return prisma.dailyLog.upsert({
      where: {
        userId_date: { userId, date },
      },
      create: {
        userId,
        date,
        ...logData,
      },
      update: logData,
    });
  }

  async deleteLog(userId: string, logId: string) {
    return prisma.dailyLog.delete({
      where: { id: logId, userId },
    });
  }

  async getStats(userId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const logs = await prisma.dailyLog.findMany({
      where: {
        userId,
        date: { gte: startDateStr },
      },
      orderBy: { date: 'asc' },
    });

    const weights = logs
      .filter(l => l.bw)
      .map(l => parseFloat(l.bw!))
      .filter(w => !isNaN(w));

    const sleeps = logs
      .filter(l => l.sleep)
      .map(l => parseFloat(l.sleep!))
      .filter(s => !isNaN(s));

    const steps = logs
      .filter(l => l.steps)
      .map(l => parseInt(l.steps!, 10))
      .filter(s => !isNaN(s));

    return {
      totalEntries: logs.length,
      weight: {
        current: weights[weights.length - 1] || null,
        average: weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
        min: weights.length ? Math.min(...weights) : null,
        max: weights.length ? Math.max(...weights) : null,
      },
      sleep: {
        average: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
      },
      steps: {
        average: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null,
        total: steps.reduce((a, b) => a + b, 0),
      },
    };
  }
}

export const logsService = new LogsService();
