import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)');

export const updatePreferencesSchema = z
  .object({
    timezone: z
      .string()
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'Unknown timezone'),
    caffeineCutoff: hhmm,
    sleepTarget: hhmm,
    proteinTarget: z.string().max(100),
    hydrationTarget: z.string().max(100),
    selectedProgramId: z.string().max(100).nullable(),
    selectedProgramDayId: z.string().max(100).nullable(),
    // Numeric targets for the server-computed Outcome Score (Bet 5).
    proteinTargetG: z.number().min(0).max(1000).nullable(),
    calorieTargetKcal: z.number().min(0).max(20000).nullable(),
    goalRateKgPerWeek: z.number().min(-3).max(3).nullable(),
  })
  // Unknown keys are stripped (not rejected) so older clients keep working.
  .partial();

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
