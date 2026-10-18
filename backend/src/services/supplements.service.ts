import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { createIdempotent } from '../utils/idempotent.js';
import { applyToggle } from './sync/toggle.js';
import {
  clockColumn,
  createClock,
  editOutcome,
  lockOwnedRow,
  mergeFieldWrite,
} from './sync/fieldClock.js';
import {
  assertNotTombstoned,
  deleteStamp,
  goneOr,
  recordTombstones,
} from './sync/tombstones.js';
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

/** Editable columns, each with its own HLC in `fieldClock`. */
export const SUPPLEMENT_FIELDS = [
  'item',
  'goal',
  'dose',
  'tier',
  'rule',
  'timeAt',
  'sortOrder',
] as const;

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

  /** Idempotent when the client sends its own `id`; 410 if that id was deleted. */
  async createSupplement(
    userId: string,
    data: SupplementFields & {
      id?: string;
      hlc?: string;
      item: string;
      goal: string;
      dose: string;
    }
  ) {
    await assertNotTombstoned(userId, 'supplement', data.id);
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
            fieldClock: createClock(
              SUPPLEMENT_FIELDS,
              fields as Record<string, unknown>,
              data.hlc
            ),
          },
        })
    );
    if (result.created) await scoreService.afterCatalogChange(userId);
    return result;
  }

  /** Per-field last-writer-wins by `hlc`; 404 missing, 410 deleted. */
  async updateSupplement(
    userId: string,
    supplementId: string,
    data: SupplementFields & { hlc?: string }
  ) {
    return prisma.$transaction(async (tx) => {
      if (!(await lockOwnedRow(tx, 'Supplement', supplementId, userId)))
        return goneOr(
          userId,
          'supplement',
          supplementId,
          new AppError('Record not found', 404)
        );
      const current = await tx.supplement.findUniqueOrThrow({
        where: { id: supplementId },
      });
      const w = mergeFieldWrite(
        SUPPLEMENT_FIELDS,
        current.fieldClock,
        pickFields(data) as Record<string, unknown>,
        data.hlc
      );
      const row =
        Object.keys(w.data).length > 0
          ? await tx.supplement.update({
              where: { id: supplementId },
              data: Object.assign({}, w.data, {
                fieldClock: clockColumn(w.clock ?? undefined),
              }),
            })
          : current;
      return Object.assign(row, editOutcome(w));
    });
  }

  /** Deletes and remembers the id (tombstone), so it can never come back. */
  async deleteSupplement(userId: string, supplementId: string, hlc?: string) {
    const deleted = await prisma.$transaction(async (tx) => {
      const row = await tx.supplement.delete({ where: { id: supplementId, userId } });
      await recordTombstones(
        tx,
        userId,
        [{ entity: 'supplement', entityId: supplementId }],
        deleteStamp(hlc)
      );
      return row;
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
