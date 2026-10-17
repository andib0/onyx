import { z } from 'zod';
import { intQuery } from './common.js';

export const searchExercisesQuerySchema = z.object({
  search: z.string().max(100).optional(),
  limit: intQuery(1, 50, 20),
});
