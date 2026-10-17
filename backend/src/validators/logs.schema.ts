import { z } from 'zod';
import { intQuery, isoDate } from './common.js';
import { clientId, hlc } from './common.schema.js';

// Field-level writes: a field that is absent is left untouched (it used to be
// overwritten with "" — docs/audit/02-sync-offline.md §2.7). Send "" to clear.
const logFields = {
  day: z.string().max(20).optional(),
  bw: z.string().max(20).optional(),
  sleep: z.string().max(20).optional(),
  steps: z.string().max(20).optional(),
  top: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
};

export const LOG_FIELDS = ['day', 'bw', 'sleep', 'steps', 'top', 'notes'] as const;
export type LogField = (typeof LOG_FIELDS)[number];

export const createOrUpdateLogSchema = z.object(
  Object.assign(
    { date: isoDate, hlc: hlc.optional(), id: clientId.optional() },
    logFields
  )
);

export const patchLogSchema = z.object(
  Object.assign({ hlc: hlc.optional(), id: clientId.optional() }, logFields)
);

export type CreateOrUpdateLogInput = z.infer<typeof createOrUpdateLogSchema>;
export type PatchLogInput = z.infer<typeof patchLogSchema>;

export const logsQuerySchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  limit: intQuery(1, 200, 50),
  offset: intQuery(0, 100000, 0),
});

export const logStatsQuerySchema = z.object({
  days: intQuery(1, 365, 30),
});
