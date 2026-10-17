import { z } from 'zod';
import { clientId, hlc } from './common.schema.js';
import { isoDate, recordId } from './common.js';

const mealTagSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(100),
});

export const createMealTemplateSchema = z.object({
  id: clientId.optional(),
  dayOfWeek: z.string().min(1, 'Day of week is required').max(20),
  name: z.string().min(1, 'Meal name is required').max(200),
  examples: z.string().max(1000).optional().default(''),
  grams: z.number().min(0).max(10000).optional().nullable(),
  foodId: recordId.optional().nullable(),
  sortOrder: z.number().int().optional(),
  tags: z.array(mealTagSchema).max(20).optional().default([]),
});

export const updateMealTemplateSchema = createMealTemplateSchema
  .omit({ id: true })
  .partial();

export const updateGramsSchema = z.object({
  grams: z.number().min(0, 'Grams must be a non-negative number').max(10000),
});

export const toggleMealLogSchema = z.object({
  date: isoDate,
  isEaten: z.boolean(),
  hlc: hlc.optional(),
  id: clientId.optional(),
});

/**
 * One-off food log (Bet 7/8): an ad-hoc food eaten today. Stored as a dated
 * template (`dayOfWeek` = the ISO date, so it never recurs on a weekday) plus
 * an eaten log for that date, created in one idempotent request.
 */
export const oneOffMealSchema = z.object({
  id: clientId.optional(),
  date: isoDate,
  name: z.string().min(1, 'Meal name is required').max(200),
  examples: z.string().max(1000).optional().default(''),
  grams: z.number().min(0).max(10000).optional().nullable(),
  foodId: recordId.optional().nullable(),
  tags: z.array(mealTagSchema).max(20).optional().default([]),
  hlc: hlc.optional(),
});

export type OneOffMealInput = z.infer<typeof oneOffMealSchema>;
export type CreateMealTemplateInput = z.infer<typeof createMealTemplateSchema>;
export type UpdateMealTemplateInput = z.infer<typeof updateMealTemplateSchema>;
export type ToggleMealLogInput = z.infer<typeof toggleMealLogSchema>;

export const templatesQuerySchema = z.object({
  day: z.string().max(20).optional(),
});

export const mealLogsQuerySchema = z.object({
  date: isoDate.optional(),
});
