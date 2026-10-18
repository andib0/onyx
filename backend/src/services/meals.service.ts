import { AppError } from '../utils/errors.js';
import { prisma } from '../config/database.js';
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

type Tag = { label: string; value: string };

/** Editable fields, each with its own HLC in `fieldClock` (tags are one field). */
export const MEAL_FIELDS = [
  'dayOfWeek',
  'name',
  'examples',
  'grams',
  'foodId',
  'sortOrder',
  'tags',
] as const;

export class MealsService {
  async getTemplates(userId: string, dayOfWeek?: string) {
    const where: { userId: string; dayOfWeek?: string } = { userId };
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;

    return prisma.mealTemplate.findMany({
      where,
      include: { tags: true },
      orderBy: [{ sortOrder: 'asc' }],
    });
  }

  /** Idempotent when the client sends its own `id`; 410 if that id was deleted. */
  async createTemplate(
    userId: string,
    data: {
      id?: string;
      hlc?: string;
      dayOfWeek: string;
      name: string;
      examples?: string;
      grams?: number | null;
      foodId?: string | null;
      sortOrder?: number;
      tags?: Tag[];
    }
  ) {
    await assertNotTombstoned(userId, 'meal', data.id);
    const { tags, hlc, ...templateData } = data;
    const result = await createIdempotent(
      userId,
      data.id,
      (id) => prisma.mealTemplate.findUnique({ where: { id }, include: { tags: true } }),
      () =>
        prisma.mealTemplate.create({
          data: {
            ...templateData,
            userId,
            fieldClock: createClock(MEAL_FIELDS, data as Record<string, unknown>, hlc),
            tags: tags ? { create: tags } : undefined,
          },
          include: { tags: true },
        })
    );
    if (result.created) await scoreService.afterCatalogChange(userId);
    return result;
  }

  /**
   * One-off food: a template dated `date` (never matches a weekday, so it does
   * not recur) plus an eaten log for that date. Idempotent on the client `id`:
   * a replay returns the same template and re-applies the eaten toggle.
   */
  async logOneOff(
    userId: string,
    data: {
      id?: string;
      date: string;
      name: string;
      examples?: string;
      grams?: number | null;
      foodId?: string | null;
      tags?: Tag[];
      hlc?: string;
    }
  ) {
    const { date, hlc, ...template } = data;
    const result = await this.createTemplate(userId, {
      ...template,
      hlc,
      dayOfWeek: date,
    });
    const log = await this.toggleLog(userId, result.row.id, date, true, { hlc });
    return { row: { template: result.row, log }, created: result.created };
  }

  async getTemplateById(userId: string, templateId: string) {
    return prisma.mealTemplate.findUnique({
      where: { id: templateId, userId },
      include: { tags: true },
    });
  }

  async updateGrams(userId: string, templateId: string, grams: number, foodId: string) {
    const food = await prisma.food.findUnique({ where: { id: foodId } });
    if (!food) throw new AppError('Food not found', 404, 'NOT_FOUND');

    // Tags hold per-100 g values; `grams` is the portion. The app and the server
    // score both compute macros as tag × grams / 100, so writing absolute
    // (already scaled) values here double-scaled every portion != 100 g.
    const per100 = (v: { toString(): string } | null) =>
      v === null ? null : Math.round(Number(v) * 10) / 10;
    const protein = per100(food.proteinPer100g);
    const carbs = per100(food.carbsPer100g);
    const fat = per100(food.fatPer100g);
    const calories = per100(food.caloriesPer100g);

    await prisma.mealTemplateTag.deleteMany({
      where: { mealTemplateId: templateId, mealTemplate: { userId } },
    });

    const newTags: Tag[] = [];
    if (protein !== null) newTags.push({ label: 'Protein', value: `${protein}` });
    if (carbs !== null) newTags.push({ label: 'Carbs', value: `${carbs}` });
    if (fat !== null) newTags.push({ label: 'Fat', value: `${fat}` });
    if (calories !== null) newTags.push({ label: 'Calories', value: `${calories}` });

    const updated = await prisma.mealTemplate.update({
      where: { id: templateId, userId },
      data: {
        grams,
        tags: { create: newTags },
      },
      include: { tags: true },
    });
    await scoreService.afterCatalogChange(userId);
    return updated;
  }

  /** Per-field last-writer-wins by `hlc` (tags = one field); 404 missing, 410 deleted. */
  async updateTemplate(
    userId: string,
    templateId: string,
    data: {
      dayOfWeek?: string;
      name?: string;
      examples?: string;
      grams?: number | null;
      foodId?: string | null;
      sortOrder?: number;
      tags?: Tag[];
      hlc?: string;
    }
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      if (!(await lockOwnedRow(tx, 'MealTemplate', templateId, userId)))
        return goneOr(userId, 'meal', templateId, new AppError('Record not found', 404));
      const current = await tx.mealTemplate.findUniqueOrThrow({
        where: { id: templateId },
        include: { tags: true },
      });
      const w = mergeFieldWrite(
        MEAL_FIELDS,
        current.fieldClock,
        data as Record<string, unknown>,
        data.hlc
      );
      if (Object.keys(w.data).length === 0) return Object.assign(current, editOutcome(w));
      const { tags, ...columns } = w.data as { tags?: Tag[] } & Record<string, unknown>;
      // Tags are replaced as a whole when they win.
      if (tags)
        await tx.mealTemplateTag.deleteMany({ where: { mealTemplateId: templateId } });
      const row = await tx.mealTemplate.update({
        where: { id: templateId },
        data: Object.assign({}, columns, {
          fieldClock: clockColumn(w.clock ?? undefined),
          tags: tags ? { create: tags } : undefined,
        }),
        include: { tags: true },
      });
      return Object.assign(row, editOutcome(w));
    });
    await scoreService.afterCatalogChange(userId);
    return updated;
  }

  /** Deletes and remembers the id (tombstone), so it can never come back. */
  async deleteTemplate(userId: string, templateId: string, hlc?: string) {
    const deleted = await prisma.$transaction(async (tx) => {
      const row = await tx.mealTemplate.delete({ where: { id: templateId, userId } });
      await recordTombstones(
        tx,
        userId,
        [{ entity: 'meal', entityId: templateId }],
        deleteStamp(hlc)
      );
      return row;
    });
    await scoreService.afterCatalogChange(userId);
    return deleted;
  }

  // Logs
  async getLogs(userId: string, date?: string) {
    const where: { userId: string; date?: string } = { userId };
    if (date) where.date = date;

    return prisma.mealLog.findMany({
      where,
      include: { mealTemplate: { include: { tags: true } } },
      orderBy: { date: 'desc' },
    });
  }

  /** Last-writer-wins by `hlc`; 404 when the template is missing or another user's. */
  async toggleLog(
    userId: string,
    mealTemplateId: string,
    date: string,
    isEaten: boolean,
    opts: { hlc?: string; id?: string } = {}
  ) {
    const outcome = await applyToggle('meal', {
      userId,
      targetId: mealTemplateId,
      date,
      value: isEaten,
      hlc: opts.hlc,
      id: opts.id,
    });
    if (outcome.applied) await scoreService.afterWrite(userId, date);
    const row = await prisma.mealLog.findUniqueOrThrow({ where: { id: outcome.id } });
    return Object.assign(row, { applied: outcome.applied });
  }
}

export const mealsService = new MealsService();
