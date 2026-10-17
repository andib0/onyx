// Streak (contracts/README.md § Streak).
//
// - Streak = consecutive kept days ending yesterday, plus today if already kept.
// - One grace day per ISO week (Mon–Sun): the first non-kept *scored* day of a
//   week neither breaks nor extends the streak; a second one in that week breaks.
// - Unscored days (nothing logged, or no row at all) are not kept and are not
//   eligible for grace, so they break the streak.
// - Today is never held against the streak while it is still running: if today
//   is not yet kept the count is the streak through yesterday, state "pending".
import { addDays, isoWeekStart } from '../../utils/dates.js';

export interface StreakDay {
  date: string; // YYYY-MM-DD, local to the user's timezone
  kept: boolean;
  scored: boolean;
}

export type StreakState = 'kept' | 'pending' | 'none';

export interface StreakResult {
  count: number;
  /** kept: today already kept; pending: streak alive, today open; none: no streak. */
  state: StreakState;
  /** Whether the grace day of the current ISO week has been consumed. */
  graceUsedThisWeek: boolean;
}

const MAX_LOOKBACK_DAYS = 3660;

export function computeStreak(days: StreakDay[], today: string): StreakResult {
  const byDate = new Map<string, StreakDay>();
  for (const d of days) {
    if (d.date <= today) byDate.set(d.date, d);
  }

  const graceUsed = new Set<string>();
  let count = 0;
  let cursor = addDays(today, -1);
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const day = byDate.get(cursor);
    if (day?.kept) {
      count += 1;
    } else if (day?.scored && !graceUsed.has(isoWeekStart(cursor))) {
      graceUsed.add(isoWeekStart(cursor));
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  const todayRow = byDate.get(today);
  const graceUsedThisWeek = graceUsed.has(isoWeekStart(today));
  if (todayRow?.kept) return { count: count + 1, state: 'kept', graceUsedThisWeek };
  if (count > 0) return { count, state: 'pending', graceUsedThisWeek };
  return { count: 0, state: 'none', graceUsedThisWeek };
}
