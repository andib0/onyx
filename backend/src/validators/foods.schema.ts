import { z } from 'zod';

export const createFoodSchema = z.object({
  name: z.string().min(1, 'Food name is required').max(300),
  brand: z.string().max(200).optional().nullable(),
  caloriesPer100g: z.number().min(0).optional().nullable(),
  proteinPer100g: z.number().min(0).optional().nullable(),
  carbsPer100g: z.number().min(0).optional().nullable(),
  fatPer100g: z.number().min(0).optional().nullable(),
  fiberPer100g: z.number().min(0).optional().nullable(),
  verified: z.boolean().optional().default(false),
});

export type CreateFoodInput = z.infer<typeof createFoodSchema>;
