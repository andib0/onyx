import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const startSessionSchema = z.object({
  date: z.string().regex(datePattern, 'Invalid date format (YYYY-MM-DD)'),
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
