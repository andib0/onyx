import { z } from 'zod';
import { intQuery, isoDate } from './common.js';

export const createOrUpdateLogSchema = z.object({
  date: isoDate,
  day: z.string().max(20).optional().default(''),
  bw: z.string().max(20).optional().default(''),
  sleep: z.string().max(20).optional().default(''),
  steps: z.string().max(20).optional().default(''),
  top: z.string().max(1000).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
});

export type CreateOrUpdateLogInput = z.infer<typeof createOrUpdateLogSchema>;

export const logsQuerySchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  limit: intQuery(1, 200, 50),
  offset: intQuery(0, 100000, 0),
});

export const logStatsQuerySchema = z.object({
  days: intQuery(1, 365, 30),
});
