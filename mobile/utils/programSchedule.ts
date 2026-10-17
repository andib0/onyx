// Program calendar: which days are training days, and which program day is
// next (audit 05 #7: the selected day never advanced and rest days didn't exist).

export type DayPlan = "train" | "rest";

type ProgramLike = {
  name?: string | null;
  description?: string | null;
  days: Array<{ id: string; dayOrder?: number }>;
};

// Sessions per week: explicit text ("3x/week", "3 times per week", "6-Day")
// wins; a 5×5 A/B program runs 3×/week by convention (Starting Strength /
// StrongLifts alternate A/B on Mon/Wed/Fri); otherwise one session per day.
export function sessionsPerWeek(program: ProgramLike): number {
  const text = `${program.name || ""} ${program.description || ""}`;
  const explicit =
    text.match(/(\d)\s*(?:x|×|times)\s*(?:\/|per|a)?\s*week/i) ||
    text.match(/(\d)\s*-?\s*day\b/i);
  let n = explicit ? Number(explicit[1]) : 0;
  if (!n && /5\s*[x×]\s*5/i.test(text) && program.days.length <= 2) n = 3;
  if (!n) n = program.days.length;
  return Math.min(Math.max(n, 1), 7);
}

// Weekday templates (0 = Monday … 6 = Sunday) that spread sessions with rest
// days between them — e.g. 3/week → Mon/Wed/Fri, 4/week → Mon/Tue/Thu/Fri.
const TEMPLATES: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function trainingWeekdays(perWeek: number): number[] {
  return TEMPLATES[Math.min(Math.max(Math.round(perWeek), 1), 7)];
}

function mondayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function planForDate(dateKey: string, perWeek: number): DayPlan {
  return trainingWeekdays(perWeek).includes(mondayIndex(dateKey)) ? "train" : "rest";
}

function orderedDays<T extends { id: string; dayOrder?: number }>(days: T[]): T[] {
  return days.slice().sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));
}

// The day after `currentId`, wrapping around; first day when unknown.
export function nextProgramDayId(
  days: Array<{ id: string; dayOrder?: number }>,
  currentId: string
): string {
  const ordered = orderedDays(days);
  if (!ordered.length) return "";
  const idx = ordered.findIndex((d) => d.id === currentId);
  if (idx === -1) return ordered[0].id;
  return ordered[(idx + 1) % ordered.length].id;
}

export type LastCompletion = { date: string; dayId: string } | null;

// Cursor advances lazily: the workout you finished stays "today's" until the
// date rolls over, then the next day is selected. Manual selection afterwards
// isn't overridden (it no longer equals the completed day).
export function resolveProgramCursor(args: {
  days: Array<{ id: string; dayOrder?: number }>;
  selectedDayId: string;
  lastCompletion: LastCompletion;
  today: string;
}): string {
  const { days, selectedDayId, lastCompletion, today } = args;
  if (!lastCompletion || lastCompletion.date >= today) return selectedDayId;
  if (lastCompletion.dayId !== selectedDayId) return selectedDayId;
  return nextProgramDayId(days, selectedDayId);
}
