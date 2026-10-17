import { AppError } from '../utils/errors.js';
import { prisma } from '../config/database.js';
import { createIdempotent } from '../utils/idempotent.js';
import { applyToggle } from './sync/toggle.js';
import { scoreService } from './score/score.service.js';

type Tag = { label: string; value: string };

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

  /** Idempotent when the client sends its own `id`. */
  async createTemplate(
    userId: string,
    data: {
      id?: string;
      dayOfWeek: string;
      name: string;
      examples?: string;
      grams?: number | null;
      foodId?: string | null;
      sortOrder?: number;
      tags?: Tag[];
    }
  ) {
    const { tags, ...templateData } = data;
    const result = await createIdempotent(
      userId,
      data.id,
      (id) => prisma.mealTemplate.findUnique({ where: { id }, include: { tags: true } }),
      () =>
        prisma.mealTemplate.create({
          data: {
            ...templateData,
            userId,
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
    const result = await this.createTemplate(userId, { ...template, dayOfWeek: date });
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

    const factor = grams / 100;
    const protein = food.proteinPer100g ? Number(food.proteinPer100g) * factor : null;
    const carbs = food.carbsPer100g ? Number(food.carbsPer100g) * factor : null;
    const calories = food.caloriesPer100g ? Number(food.caloriesPer100g) * factor : null;

    await prisma.mealTemplateTag.deleteMany({
      where: { mealTemplateId: templateId, mealTemplate: { userId } },
    });

    const newTags: Tag[] = [];
    if (protein !== null)
      newTags.push({ label: 'Protein', value: `${Math.round(protein)}` });
    if (carbs !== null) newTags.push({ label: 'Carbs', value: `${Math.round(carbs)}` });
    if (calories !== null)
      newTags.push({ label: 'Calories', value: `${Math.round(calories)}` });

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
    }
  ) {
    const { tags, ...templateData } = data;

    // If tags are provided, replace them
    if (tags) {
      await prisma.mealTemplateTag.deleteMany({
        where: { mealTemplateId: templateId, mealTemplate: { userId } },
      });
    }

    const updated = await prisma.mealTemplate.update({
      where: { id: templateId, userId },
      data: {
        ...templateData,
        tags: tags ? { create: tags } : undefined,
      },
      include: { tags: true },
    });
    await scoreService.afterCatalogChange(userId);
    return updated;
  }

  async deleteTemplate(userId: string, templateId: string) {
    const deleted = await prisma.mealTemplate.delete({
      where: { id: templateId, userId },
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
