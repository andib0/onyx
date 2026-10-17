import { z } from 'zod';
import { recordId } from './common.js';
import { clientId } from './common.schema.js';

export const addUserFoodSchema = z.object({
  id: clientId.optional(),
  foodId: recordId,
});

export type AddUserFoodInput = z.infer<typeof addUserFoodSchema>;
