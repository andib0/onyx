import { z } from 'zod';
import { isCalendarDate } from '../utils/dates.js';
import { hlcProblem } from '../utils/hlc.js';

/** "YYYY-MM-DD" that is a real calendar date (2000–2100). */
export const isoDate = z
  .string()
  .refine(isCalendarDate, 'Invalid date (expected a real YYYY-MM-DD)');

/** Client-generated row id (Bet 2 idempotent creates). */
export const clientId = z.string().uuid('id must be a UUID');

/** Hybrid logical clock stamp: <13-digit ms>-<4-digit counter>-<deviceId>. */
export const hlc = z.string().superRefine((value, ctx) => {
  const problem = hlcProblem(value);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

/** ISO-8601 timestamp sent by a client (e.g. when a workout started offline). */
export const clientTimestamp = z.string().datetime({ offset: true });
