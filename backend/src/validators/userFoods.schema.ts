import { z } from 'zod';
import { recordId } from './common.js';

export const addUserFoodSchema = z.object({
  foodId: recordId,
});
