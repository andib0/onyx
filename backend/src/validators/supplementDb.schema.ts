import { z } from 'zod';
import { intQuery } from './common.js';

export const supplementDbQuerySchema = z.object({
  search: z.string().max(100).optional(),
  limit: intQuery(1, 200, 50),
});
