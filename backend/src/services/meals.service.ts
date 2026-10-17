import { AppError } from '../utils/errors.js';
import { prisma } from '../config/database.js';

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

  async createTemplate(
    userId: string,
    data: {
      dayOfWeek: string;
      name: string;
      examples?: string;
      grams?: number;
      foodId?: string;
      sortOrder?: number;
      tags?: Array<{ label: string; value: string }>;
    }
  ) {
    const { tags, ...templateData } = data;
    return prisma.mealTemplate.create({
      data: {
        userId,
        ...templateData,
        tags: tags
          ? {
              create: tags,
            }
          : undefined,
      },
      include: { tags: true },
    });
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

    const newTags: Array<{ label: string; value: string }> = [];
    if (protein !== null)
      newTags.push({ label: 'Protein', value: `${Math.round(protein)}` });
    if (carbs !== null) newTags.push({ label: 'Carbs', value: `${Math.round(carbs)}` });
    if (calories !== null)
      newTags.push({ label: 'Calories', value: `${Math.round(calories)}` });

    return prisma.mealTemplate.update({
      where: { id: templateId, userId },
      data: {
        grams,
        tags: { create: newTags },
      },
      include: { tags: true },
    });
  }

  async updateTemplate(
    userId: string,
    templateId: string,
    data: {
      dayOfWeek?: string;
      name?: string;
      examples?: string;
      grams?: number;
      sortOrder?: number;
      tags?: Array<{ label: string; value: string }>;
    }
  ) {
    const { tags, ...templateData } = data;

    // Ownership BEFORE touching tags (audit F3): a non-owner used to wipe the
    // owner's tags and only then get a 404 from the scoped update.
    const owned = await prisma.mealTemplate.findFirst({
      where: { id: templateId, userId },
      select: { id: true },
    });
    if (!owned) throw new AppError('Meal template not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      // If tags are provided, replace them
      if (tags) {
        await tx.mealTemplateTag.deleteMany({
          where: { mealTemplateId: templateId, mealTemplate: { userId } },
        });
      }

      return tx.mealTemplate.update({
        where: { id: templateId, userId },
        data: {
          ...templateData,
          tags: tags
            ? {
                create: tags,
              }
            : undefined,
        },
        include: { tags: true },
      });
    });
  }

  async deleteTemplate(userId: string, templateId: string) {
    return prisma.mealTemplate.delete({
      where: { id: templateId, userId },
    });
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

  async toggleLog(
    userId: string,
    mealTemplateId: string,
    date: string,
    isEaten: boolean
  ) {
    // Ownership first (audit F2): see supplements.toggleLog.
    const owned = await prisma.mealTemplate.findFirst({
      where: { id: mealTemplateId, userId },
      select: { id: true },
    });
    if (!owned) throw new AppError('Meal template not found', 404, 'NOT_FOUND');

    return prisma.mealLog.upsert({
      where: {
        userId_mealTemplateId_date: { userId, mealTemplateId, date },
      },
      create: {
        userId,
        mealTemplateId,
        date,
        isEaten,
        eatenAt: isEaten ? new Date() : null,
      },
      update: {
        isEaten,
        eatenAt: isEaten ? new Date() : null,
      },
    });
  }
}

export const mealsService = new MealsService();
