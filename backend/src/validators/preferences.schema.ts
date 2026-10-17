import { z } from 'zod';
import { recordId } from './common.js';

/** Accepts "9:30" as well as "09:30" (the settings screen allows both). */
const clock = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:MM)');

function isIanaZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Explicit allowlist (audit F4): the raw body used to go straight into
 * prisma.userPreferences.update, which accepts nested relation writes.
 */
export const updatePreferencesSchema = z.object({
  timezone: z.string().min(1).max(64).refine(isIanaZone, 'Unknown timezone').optional(),
  caffeineCutoff: clock.optional(),
  sleepTarget: clock.optional(),
  proteinTarget: z.string().max(50).optional(),
  hydrationTarget: z.string().max(50).optional(),
  selectedProgramId: recordId.nullable().optional(),
  selectedProgramDayId: recordId.nullable().optional(),
  // Numeric targets for the server-computed Outcome Score (Bet 5).
  proteinTargetG: z.number().min(0).max(1000).nullable().optional(),
  calorieTargetKcal: z.number().min(0).max(20000).nullable().optional(),
  goalRateKgPerWeek: z.number().min(-3).max(3).nullable().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
