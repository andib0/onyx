import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  isCalendarDate,
  isoWeekday,
  isoWeekStart,
  localDateKey,
  weekdayName,
} from './dates.js';

describe('dates', () => {
  it('accepts real calendar dates only (audit 02 §2.5)', () => {
    expect(isCalendarDate('2026-10-17')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    for (const bad of [
      '2026-02-31',
      '2026-13-45',
      '9999-99-99',
      '1970-01-01',
      '2026-1-1',
    ]) {
      expect(isCalendarDate(bad)).toBe(false);
    }
  });

  it('does day arithmetic across month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('maps ISO weekdays and week starts', () => {
    expect(isoWeekday('2026-10-19')).toBe(1); // Monday
    expect(isoWeekday('2026-10-18')).toBe(7); // Sunday
    expect(weekdayName('2026-10-17')).toBe('Saturday');
    expect(isoWeekStart('2026-10-18')).toBe('2026-10-12');
    expect(isoWeekStart('2026-10-19')).toBe('2026-10-19');
  });

  it('computes local "today" in the user timezone', () => {
    const t = new Date('2026-10-17T23:30:00Z');
    expect(localDateKey('UTC', t)).toBe('2026-10-17');
    expect(localDateKey('Europe/Belgrade', t)).toBe('2026-10-18');
    expect(localDateKey('America/Los_Angeles', t)).toBe('2026-10-17');
    expect(localDateKey('Not/AZone', t)).toBe('2026-10-17');
  });
});
