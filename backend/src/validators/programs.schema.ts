import { z } from 'zod';
import { clientId } from './common.schema.js';

const exerciseSchema = z.object({
  id: clientId.optional(),
  exerciseName: z.string().min(1).max(200),
  sets: z.string().min(1).max(20),
  reps: z.string().min(1).max(30),
  rir: z.string().max(20).nullable().optional(),
  restSeconds: z.string().max(20).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  progression: z.string().max(500).nullable().optional(),
});

const daySchema = z.object({
  id: clientId.optional(),
  name: z.string().min(1).max(100),
  /** ISO weekdays (1 = Monday … 7 = Sunday) this day is planned on. */
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  exercises: z.array(exerciseSchema).min(1).max(30),
});

export const programSchema = z.object({
  id: clientId.optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  goal: z.enum(['bulk', 'cut', 'recomp', 'strength', 'general']),
  days: z.array(daySchema).min(1).max(7),
});

export const updateProgramSchema = programSchema.omit({ id: true });

export type ProgramInput = z.infer<typeof programSchema>;
