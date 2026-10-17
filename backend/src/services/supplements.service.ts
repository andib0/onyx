import { prisma } from '../config/database.js';
import { createIdempotent } from '../utils/idempotent.js';
import { applyToggle } from './sync/toggle.js';
import { scoreService } from './score/score.service.js';

interface SupplementFields {
  item?: string;
  goal?: string;
  dose?: string;
  tier?: string;
  rule?: string;
  timeAt?: string;
  sortOrder?: number;
}

// Only model columns reach Prisma (the create schema also accepts reference
// fields such as `category` that are not stored on Supplement).
function pickFields(data: SupplementFields): SupplementFields {
  const out: SupplementFields = {};
  for (const k of [
    'item',
    'goal',
    'dose',
    'tier',
    'rule',
    'timeAt',
    'sortOrder',
  ] as const) {
    if (data[k] !== undefined) Object.assign(out, { [k]: data[k] });
  }
  return out;
}

export class SupplementsService {
  async getSupplements(userId: string) {
    return prisma.supplement.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { timeAt: 'asc' }],
    });
  }

  /** Idempotent when the client sends its own `id`. */
  async createSupplement(
    userId: string,
    data: SupplementFields & { id?: string; item: string; goal: string; dose: string }
  ) {
    const fields = pickFields(data);
    const result = await createIdempotent(
      userId,
      data.id,
      (id) => prisma.supplement.findUnique({ where: { id } }),
      () =>
        prisma.supplement.create({
          data: {
            id: data.id,
            userId,
            item: data.item,
            goal: data.goal,
            dose: data.dose,
            tier: fields.tier,
            rule: fields.rule,
            timeAt: fields.timeAt,
            sortOrder: fields.sortOrder,
          },
        })
    );
    if (result.created) await scoreService.afterCatalogChange(userId);
    return result;
  }

  async updateSupplement(userId: string, supplementId: string, data: SupplementFields) {
    return prisma.supplement.update({
      where: { id: supplementId, userId },
      data: pickFields(data),
    });
  }

  async deleteSupplement(userId: string, supplementId: string) {
    const deleted = await prisma.supplement.delete({
      where: { id: supplementId, userId },
    });
    await scoreService.afterCatalogChange(userId);
    return deleted;
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

  /** Last-writer-wins by `hlc`; 404 when the supplement is missing or not the user's. */
  async toggleLog(
    userId: string,
    supplementId: string,
    date: string,
    isTaken: boolean,
    opts: { hlc?: string; id?: string } = {}
  ) {
    const outcome = await applyToggle('supplement', {
      userId,
      targetId: supplementId,
      date,
      value: isTaken,
      hlc: opts.hlc,
      id: opts.id,
    });
    if (outcome.applied) await scoreService.afterWrite(userId, date);
    const row = await prisma.supplementLog.findUniqueOrThrow({
      where: { id: outcome.id },
    });
    return Object.assign(row, { applied: outcome.applied });
  }
}

export const supplementsService = new SupplementsService();
