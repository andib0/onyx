// Implementation intention (Bet 9): "I will train on [days] at [time] at [place]".
//
// Gollwitzer & Sheeran 2006 (Adv Exp Soc Psychol 38:69–119; 94 studies): if-then
// plans that name *when* and *where* raise goal attainment with d ≈ 0.65 — the
// single highest-leverage omission in onboarding (audit 06 §3). The plan drives
// which days are training days, the training block's time and the reminder.

export type TrainingIntention = {
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  time: string; // "HH:MM"
  place: string;
};

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** ISO weekday (1 = Mon … 7 = Sun) of a local "YYYY-MM-DD" key. */
export function isoWeekdayOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Default spread for N sessions/week, rest days between (matches programSchedule). */
export function defaultWeekdays(perWeek: number): number[] {
  const table: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 7],
  };
  return table[Math.min(Math.max(Math.round(perWeek) || 3, 1), 7)];
}

export function isTrainingDate(intention: TrainingIntention, dateKey: string): boolean {
  return intention.weekdays.includes(isoWeekdayOfKey(dateKey));
}

export function normalizeIntention(raw: unknown): TrainingIntention | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<TrainingIntention>;
  const weekdays = Array.isArray(r.weekdays)
    ? Array.from(
        new Set(r.weekdays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))
      ).sort((a, b) => a - b)
    : [];
  const time = typeof r.time === "string" && /^\d{2}:\d{2}$/.test(r.time) ? r.time : "";
  if (!weekdays.length || !time) return null;
  return { weekdays, time, place: typeof r.place === "string" ? r.place.trim() : "" };
}

/** "Mon, Wed, Fri at 17:30 · Gym" */
export function describeIntention(i: TrainingIntention): string {
  const days = i.weekdays.map((d) => WEEKDAY_SHORT[d - 1]).join(", ");
  return `${days} at ${i.time}${i.place ? ` · ${i.place}` : ""}`;
}
