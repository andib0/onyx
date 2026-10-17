import { describe, expect, it } from 'vitest';
import { computeStreak, type StreakDay } from './streak.js';
import { addDays } from '../../utils/dates.js';

// contracts/README.md § Streak. Today = Saturday 2026-10-17 (ISO week Mon 12 – Sun 18).
const TODAY = '2026-10-17';

/** Build history from a string read oldest → newest ending YESTERDAY:
 *  K = kept, M = scored but missed, U = unscored (nothing logged), . = no row. */
function history(pattern: string, endDate = addDays(TODAY, -1)): StreakDay[] {
  const days: StreakDay[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const date = addDays(endDate, i - (pattern.length - 1));
    const ch = pattern[i];
    if (ch === '.') continue;
    days.push({ date, kept: ch === 'K', scored: ch !== 'U' });
  }
  return days;
}

const withToday = (days: StreakDay[], kept: boolean, scored = true) =>
  days.concat([{ date: TODAY, kept, scored }]);

describe('computeStreak', () => {
  it('counts consecutive kept days ending yesterday; today pending is never 0', () => {
    const r = computeStreak(history('KKKKK'), TODAY);
    expect(r).toEqual({ count: 5, state: 'pending', graceUsedThisWeek: false });
  });

  it('adds today once it is kept', () => {
    const r = computeStreak(withToday(history('KKKKK'), true), TODAY);
    expect(r.count).toBe(6);
    expect(r.state).toBe('kept');
  });

  it('a scored-but-not-kept today stays pending until the day ends', () => {
    const r = computeStreak(withToday(history('KKK'), false), TODAY);
    expect(r).toEqual({ count: 3, state: 'pending', graceUsedThisWeek: false });
  });

  it('shows state none with 0 when there is no streak and today is not kept', () => {
    expect(computeStreak(history('KKM.'), TODAY)).toEqual({
      count: 0,
      state: 'none',
      graceUsedThisWeek: false,
    });
    expect(computeStreak([], TODAY).state).toBe('none');
  });

  it('first missed (scored) day of an ISO week is a grace day: no break, no add', () => {
    // Fri 16 missed, Mon 12 … Thu 15 kept.
    const r = computeStreak(history('KKKKM'), TODAY);
    expect(r).toEqual({ count: 4, state: 'pending', graceUsedThisWeek: true });
  });

  it('a second miss in the same ISO week breaks the streak', () => {
    // Mon 12 kept, Tue 13 missed, Wed 14 kept, Thu 15 missed, Fri 16 kept.
    const r = computeStreak(history('KMKMK'), TODAY);
    // Fri 16 + Wed 14 count, Thu 15 uses the grace, Tue 13 breaks.
    expect(r.count).toBe(2);
  });

  it('grace resets per ISO week (misses 7 days apart both forgiven)', () => {
    // 2026-10-09 (Fri, previous week) missed and 2026-10-16 (Fri, this week) missed.
    const r = computeStreak(history('KKKKMKKKKKKM'), TODAY);
    // 12 days back from yesterday: 10 kept + 2 grace days.
    expect(r.count).toBe(10);
  });

  it('two misses in consecutive days of different weeks are both forgiven', () => {
    // Sun 2026-10-11 missed (week of Oct 5), Mon 2026-10-12 missed (week of Oct 12).
    const days = history('KKKMMKKKK');
    const r = computeStreak(days, TODAY);
    expect(r.count).toBe(7);
  });

  it('an unscored day (nothing logged) is not kept and is not eligible for grace', () => {
    const r = computeStreak(history('KKKUKK'), TODAY);
    expect(r.count).toBe(2);
  });

  it('a day without any row counts as unscored and breaks', () => {
    const r = computeStreak(history('KKK.KK'), TODAY);
    expect(r.count).toBe(2);
  });

  it("today's grace-eligible miss does not consume this week's grace while pending", () => {
    const r = computeStreak(withToday(history('KKKKM'), false), TODAY);
    expect(r.count).toBe(4);
    expect(r.state).toBe('pending');
  });

  it('is not capped at 30 or 31 days (audit 04 A3.5)', () => {
    const r = computeStreak(history('K'.repeat(400)), TODAY);
    expect(r.count).toBe(400);
  });

  it('ignores rows after today and does not depend on input order', () => {
    const days = history('KKK').concat([
      { date: addDays(TODAY, 1), kept: true, scored: true },
    ]);
    expect(computeStreak(days.slice().reverse(), TODAY).count).toBe(3);
  });
});
