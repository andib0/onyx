import { z } from 'zod';
import { intQuery } from './common.js';

const per100g = z.number().min(0).max(100000).optional().nullable();

// No `verified` flag: users can't mark their own entries as verified (audit
// F11); the old `verified` default also made Prisma reject every create.
export const createFoodSchema = z.object({
  name: z.string().trim().min(1, 'Food name is required').max(300),
  brand: z.string().max(200).optional().nullable(),
  caloriesPer100g: per100g,
  proteinPer100g: per100g,
  carbsPer100g: per100g,
  fatPer100g: per100g,
  fiberPer100g: per100g,
  sugarPer100g: per100g,
  sodiumMgPer100g: per100g,
});

export const searchFoodsQuerySchema = z.object({
  search: z
    .string({ required_error: 'Search query must be at least 2 characters' })
    .trim()
    .min(2, 'Search query must be at least 2 characters')
    .max(100),
  limit: intQuery(1, 100, 50),
});

export type CreateFoodInput = z.infer<typeof createFoodSchema>;
