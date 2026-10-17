import { z } from 'zod';
import { intQuery, isoDate, recordId } from './common.js';

export const startSessionSchema = z.object({
  date: isoDate,
  programDayName: z.string().max(100).optional(),
});

export const logSetSchema = z.object({
  exerciseName: z.string().min(1).max(200),
  setNumber: z.number().int().min(1).max(50),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  reps: z.number().int().min(0).max(200).nullable().optional(),
  rir: z.string().max(20).nullable().optional(),
});

export const finishSessionSchema = z.object({
  durationSeconds: z.number().int().min(0).max(86400).optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type LogSetInput = z.infer<typeof logSetSchema>;
export type FinishSessionInput = z.infer<typeof finishSessionSchema>;

export const sessionsQuerySchema = z.object({
  limit: intQuery(1, 100, 30),
  offset: intQuery(0, 100000, 0),
});

export const exerciseSessionsQuerySchema = z.object({
  name: z.string().max(200).optional(),
  limit: intQuery(1, 100, 30),
});

export const exerciseHistoryQuerySchema = z.object({
  names: z.string().max(10000).optional(),
  excludeSessionId: recordId.optional(),
});
