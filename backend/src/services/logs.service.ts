import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database.js';
import { hlcWins } from '../utils/hlc.js';
import { LOG_FIELDS, type LogField } from '../validators/logs.schema.js';
import { scoreService } from './score/score.service.js';

export class LogsService {
  async getLogs(
    userId: string,
    startDate?: string,
    endDate?: string,
    limit = 50,
    offset = 0
  ) {
    const where: { userId: string; date?: { gte?: string; lte?: string } } = { userId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return prisma.dailyLog.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getLog(userId: string, date: string) {
    return prisma.dailyLog.findUnique({
      where: {
        userId_date: { userId, date },
      },
    });
  }

  /**
   * Field-level write of one day's log (Bet 2). Only fields present in `input`
   * are written. With an `hlc`, each field is applied only if the hlc is newer
   * than that field's stored clock (`fieldClock`), so two devices editing
   * different — or the same — fields of a day converge regardless of delivery
   * order. Without an `hlc` (legacy client) present fields are applied as-is.
   */
  async patchLog(
    userId: string,
    date: string,
    input: Partial<Record<LogField, string>> & { hlc?: string; id?: string }
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const inserted = await tx.$executeRaw`
        INSERT INTO "DailyLog" ("id", "userId", "date", "updatedAt")
        VALUES (${input.id ?? randomUUID()}, ${userId}, ${date}, (now() AT TIME ZONE 'UTC'))
        ON CONFLICT ("userId", "date") DO NOTHING`;
      const [current] = await tx.$queryRaw<Array<{ id: string; fieldClock: unknown }>>`
        SELECT "id", "fieldClock" FROM "DailyLog"
        WHERE "userId" = ${userId} AND "date" = ${date}
        FOR UPDATE`;
      const clock: Record<string, string> =
        current.fieldClock && typeof current.fieldClock === 'object'
          ? Object.assign({}, current.fieldClock as Record<string, string>)
          : {};
      const data: Partial<Record<LogField, string>> = {};
      const appliedFields: LogField[] = [];
      const staleFields: LogField[] = [];
      for (const field of LOG_FIELDS) {
        const value = input[field];
        if (value === undefined) continue;
        if (!input.hlc || hlcWins(input.hlc, clock[field])) {
          data[field] = value;
          if (input.hlc) clock[field] = input.hlc;
          appliedFields.push(field);
        } else {
          staleFields.push(field);
        }
      }
      const row = await tx.dailyLog.update({
        where: { id: current.id },
        data: Object.assign(data, { fieldClock: clock }),
      });
      return { row, created: inserted > 0, appliedFields, staleFields };
    });
    if (result.appliedFields.some((f) => f === 'bw' || f === 'day')) {
      // A weigh-in moves the 14-weigh-in trend of the following days too.
      await scoreService.afterWrite(userId, date, 13);
    }
    return {
      row: Object.assign(result.row, {
        appliedFields: result.appliedFields,
        staleFields: result.staleFields,
      }),
      created: result.created,
    };
  }

  /** Legacy POST /logs: same field-level semantics as patchLog. */
  async createOrUpdateLog(
    userId: string,
    data: Partial<Record<LogField, string>> & { date: string; hlc?: string; id?: string }
  ) {
    const { date, ...rest } = data;
    return (await this.patchLog(userId, date, rest)).row;
  }

  async deleteLog(userId: string, logId: string) {
    const deleted = await prisma.dailyLog.delete({
      where: { id: logId, userId },
    });
    await scoreService.afterWrite(userId, deleted.date, 13);
    return deleted;
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
      .filter((l) => l.bw)
      .map((l) => parseFloat(l.bw!))
      .filter((w) => !isNaN(w));

    const sleeps = logs
      .filter((l) => l.sleep)
      .map((l) => parseFloat(l.sleep!))
      .filter((s) => !isNaN(s));

    const steps = logs
      .filter((l) => l.steps)
      .map((l) => parseInt(l.steps!, 10))
      .filter((s) => !isNaN(s));

    return {
      totalEntries: logs.length,
      weight: {
        current: weights[weights.length - 1] || null,
        average: weights.length
          ? weights.reduce((a, b) => a + b, 0) / weights.length
          : null,
        min: weights.length ? Math.min(...weights) : null,
        max: weights.length ? Math.max(...weights) : null,
      },
      sleep: {
        average: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
      },
      steps: {
        average: steps.length
          ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length)
          : null,
        total: steps.reduce((a, b) => a + b, 0),
      },
    };
  }
}

export const logsService = new LogsService();
