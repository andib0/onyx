// Calendar-date helpers for "YYYY-MM-DD" day keys. All arithmetic is done in
// UTC on the date itself, so results never depend on the server's timezone.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date ("2026-02-31" and "2026-13-01" are rejected). */
export function isCalendarDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const wd = toUtc(date).getUTCDay();
  return wd === 0 ? 7 : wd;
}

const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** "Monday" … "Sunday" — the MealTemplate.dayOfWeek vocabulary. */
export function weekdayName(date: string): string {
  return WEEKDAY_NAMES[isoWeekday(date) - 1];
}

/** Monday of the ISO week containing `date` (a stable per-week key). */
export function isoWeekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** Today's date key in an IANA timezone (falls back to UTC if unknown). */
export function localDateKey(
  timezone: string | null | undefined,
  now = new Date()
): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
