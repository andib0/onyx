// Sync primitives (Bet 2). General validators live in ./common.ts.
import { z } from 'zod';
import { hlcProblem } from '../utils/hlc.js';

export { isoDate } from './common.js';

/** Client-generated row id (Bet 2 idempotent creates). */
export const clientId = z.string().uuid('id must be a UUID');

/** Hybrid logical clock stamp: <13-digit ms>-<4-digit counter>-<deviceId>. */
export const hlc = z.string().superRefine((value, ctx) => {
  const problem = hlcProblem(value);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

/** ISO-8601 timestamp sent by a client (e.g. when a workout started offline). */
export const clientTimestamp = z.string().datetime({ offset: true });
