import { z } from 'zod';
import { intQuery, isoDate } from './common.js';

const count = z.number().int().min(0).max(1000).optional();

// Legacy client snapshot. Still validated (bounded numbers) for compatibility,
// but only `date` is used: the server computes the day's score itself, so a
// stale device can no longer overwrite it (Bet 5, audit 02 §2.6).
export const upsertScoreSchema = z.object({
  date: isoDate,
  score: z.number().min(0).max(100),
  tasksDone: count,
  tasksTotal: count,
  suppDone: count,
  suppTotal: count,
  mealsDone: count,
  mealsTotal: count,
  workoutDone: z.boolean().optional(),
  protein: z.number().min(0).max(10000).optional(),
  calories: z.number().min(0).max(100000).optional(),
});

export const scoresQuerySchema = z.object({
  days: intQuery(1, 365, 30),
  /** "2" → { today, todayScore, streak, days } instead of the v1 array. */
  v: z.enum(['1', '2']).optional(),
});

export type UpsertScoreInput = z.infer<typeof upsertScoreSchema>;
