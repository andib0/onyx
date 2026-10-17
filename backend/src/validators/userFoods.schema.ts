import { z } from 'zod';
import { clientId } from './common.schema.js';

export const addUserFoodSchema = z.object({
  id: clientId.optional(),
  foodId: z.string().min(1, 'foodId is required').max(100),
});

export type AddUserFoodInput = z.infer<typeof addUserFoodSchema>;
