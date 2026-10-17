import { z } from 'zod';
import { clientId, clientTimestamp, hlc, isoDate } from './common.schema.js';

export const startSessionSchema = z.object({
  id: clientId.optional(),
  date: isoDate,
  programDayName: z.string().max(100).optional(),
  /** When the session really started (an offline device sends it later). */
  startedAt: clientTimestamp.optional(),
});

export const logSetSchema = z.object({
  id: clientId.optional(),
  hlc: hlc.optional(),
  exerciseName: z.string().min(1).max(200),
  setNumber: z.number().int().min(1).max(50),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  reps: z.number().int().min(0).max(200).nullable().optional(),
  rir: z.string().max(20).nullable().optional(),
});

export const finishSessionSchema = z.object({
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  endedAt: clientTimestamp.optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type LogSetInput = z.infer<typeof logSetSchema>;
export type FinishSessionInput = z.infer<typeof finishSessionSchema>;
