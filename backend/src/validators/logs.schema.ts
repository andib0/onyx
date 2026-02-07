import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createOrUpdateLogSchema = z.object({
  date: z.string().regex(datePattern, 'Invalid date format (YYYY-MM-DD)'),
  day: z.string().max(20).optional().default(''),
  bw: z.string().max(20).optional().default(''),
  sleep: z.string().max(20).optional().default(''),
  steps: z.string().max(20).optional().default(''),
  top: z.string().max(1000).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
});

export type CreateOrUpdateLogInput = z.infer<typeof createOrUpdateLogSchema>;
