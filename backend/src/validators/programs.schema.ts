import { z } from 'zod';

const exerciseSchema = z.object({
  exerciseName: z.string().min(1).max(200),
  sets: z.string().min(1).max(20),
  reps: z.string().min(1).max(30),
  rir: z.string().max(20).nullable().optional(),
  restSeconds: z.string().max(20).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  progression: z.string().max(500).nullable().optional(),
});

const daySchema = z.object({
  name: z.string().min(1).max(100),
  exercises: z.array(exerciseSchema).min(1).max(30),
});

export const programSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  goal: z.enum(['bulk', 'cut', 'recomp', 'strength', 'general']),
  days: z.array(daySchema).min(1).max(7),
});

export type ProgramInput = z.infer<typeof programSchema>;
