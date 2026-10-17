import { prisma } from '../config/database.js';
import { createIdempotent } from '../utils/idempotent.js';
import { applyToggle } from './sync/toggle.js';
import { scoreService } from './score/score.service.js';

export class ScheduleService {
  async getBlocks(userId: string) {
    return prisma.scheduleBlock.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { start: 'asc' }],
    });
  }

  /** Idempotent when the client sends its own `id` (retries return the same row). */
  async createBlock(
    userId: string,
    data: {
      id?: string;
      start: string;
      end: string;
      title: string;
      purpose?: string;
      good?: string;
      tag?: string;
      readonly?: boolean;
      source?: string;
      sortOrder?: number;
    }
  ) {
    const result = await createIdempotent(
      userId,
      data.id,
      (id) => prisma.scheduleBlock.findUnique({ where: { id } }),
      () => prisma.scheduleBlock.create({ data: { ...data, userId } })
    );
    if (result.created) await scoreService.afterCatalogChange(userId);
    return result;
  }

  async updateBlock(
    userId: string,
    blockId: string,
    data: {
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
  ) {
    return prisma.scheduleBlock.update({
      where: { id: blockId, userId },
      data,
    });
  }

  async deleteBlock(userId: string, blockId: string) {
    const deleted = await prisma.scheduleBlock.delete({
      where: { id: blockId, userId },
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
   * exist or belongs to another user. The returned row carries `applied: false`
   * when a newer write was already stored.
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
