import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const mealTagSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(100),
});

export const createMealTemplateSchema = z.object({
  dayOfWeek: z.string().min(1, 'Day of week is required'),
  name: z.string().min(1, 'Meal name is required').max(200),
  examples: z.string().max(1000).optional().default(''),
  grams: z.number().min(0).optional().nullable(),
  foodId: z.string().optional().nullable(),
  tags: z.array(mealTagSchema).optional().default([]),
});

export const updateMealTemplateSchema = createMealTemplateSchema.partial();

export const updateGramsSchema = z.object({
  grams: z.number().min(0, 'Grams must be a non-negative number'),
});

export const toggleMealLogSchema = z.object({
  date: z.string().regex(datePattern, 'Invalid date format (YYYY-MM-DD)'),
  isEaten: z.boolean(),
});

export type CreateMealTemplateInput = z.infer<typeof createMealTemplateSchema>;
export type UpdateMealTemplateInput = z.infer<typeof updateMealTemplateSchema>;
export type ToggleMealLogInput = z.infer<typeof toggleMealLogSchema>;
