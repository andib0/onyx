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

interface BlockFields {
  start?: string;
  end?: string;
  title?: string;
  purpose?: string;
  good?: string;
  tag?: string;
  readonly?: boolean;
  source?: string;
  sortOrder?: number;
}

/** Editable columns, each with its own HLC in `fieldClock`. */
export const BLOCK_FIELDS = [
  'start',
  'end',
  'title',
  'purpose',
  'good',
  'tag',
  'readonly',
  'source',
  'sortOrder',
] as const;

export class ScheduleService {
  async getBlocks(userId: string) {
    return prisma.scheduleBlock.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { start: 'asc' }],
    });
  }

  /** Idempotent when the client sends its own `id`; 410 if that id was deleted. */
  async createBlock(
    userId: string,
    data: BlockFields & {
      id?: string;
      hlc?: string;
      start: string;
      end: string;
      title: string;
    }
  ) {
    await assertNotTombstoned(userId, 'block', data.id);
    const { hlc, ...fields } = data;
    const result = await createIdempotent(
      userId,
      data.id,
      (id) => prisma.scheduleBlock.findUnique({ where: { id } }),
      () =>
        prisma.scheduleBlock.create({
          data: Object.assign({}, fields, {
            userId,
            fieldClock: createClock(BLOCK_FIELDS, fields, hlc),
          }),
        })
    );
    if (result.created) await scoreService.afterCatalogChange(userId);
    return result;
  }

  /** Per-field last-writer-wins by `hlc`; 404 missing, 410 deleted. */
  async updateBlock(
    userId: string,
    blockId: string,
    data: BlockFields & { hlc?: string }
  ) {
    const { hlc, ...patch } = data;
    return prisma.$transaction(async (tx) => {
      if (!(await lockOwnedRow(tx, 'ScheduleBlock', blockId, userId)))
        return goneOr(userId, 'block', blockId, new AppError('Record not found', 404));
      const current = await tx.scheduleBlock.findUniqueOrThrow({
        where: { id: blockId },
      });
      const w = mergeFieldWrite(BLOCK_FIELDS, current.fieldClock, patch, hlc);
      const row =
        Object.keys(w.data).length > 0
          ? await tx.scheduleBlock.update({
              where: { id: blockId },
              data: Object.assign({}, w.data, {
                fieldClock: clockColumn(w.clock ?? undefined),
              }),
            })
          : current;
      return Object.assign(row, editOutcome(w));
    });
  }

  /** Deletes and remembers the id (tombstone), so it can never come back. */
  async deleteBlock(userId: string, blockId: string, hlc?: string) {
    const deleted = await prisma.$transaction(async (tx) => {
      const row = await tx.scheduleBlock.delete({ where: { id: blockId, userId } });
      await recordTombstones(
        tx,
        userId,
        [{ entity: 'block', entityId: blockId }],
        deleteStamp(hlc)
      );
      return row;
    });
    await scoreService.afterCatalogChange(userId);
    return deleted;
  }

  // Completions
  async getCompletions(userId: string, date: string) {
    return prisma.completion.findMany({
      where: { userId, date },
    });
  }

  /**
   * Last-writer-wins by `hlc` when provided (Bet 2); 404 when the block does not
   * exist or belongs to another user, 410 when it was deleted. The returned row
   * carries `applied: false` when a newer write was already stored.
   */
  async toggleCompletion(
    userId: string,
    blockId: string,
    date: string,
    isComplete: boolean,
    opts: { hlc?: string; id?: string } = {}
  ) {
    const outcome = await applyToggle('completion', {
      userId,
      targetId: blockId,
      date,
      value: isComplete,
      hlc: opts.hlc,
      id: opts.id,
    });
    if (outcome.applied) await scoreService.afterWrite(userId, date);
    const row = await prisma.completion.findUniqueOrThrow({ where: { id: outcome.id } });
    return Object.assign(row, { applied: outcome.applied });
  }
}

export const scheduleService = new ScheduleService();
