import { describe, expect, it } from 'vitest';
import {
  bodyweightSlope,
  leadingNumber,
  resolvePlan,
  routinePercent,
  scoreDay,
  templateMacros,
  type DayFacts,
  type PlanDay,
} from './dayFacts.js';
import { addDays } from '../../utils/dates.js';

describe('leadingNumber', () => {
  it('parses the first number of free text', () => {
    expect(leadingNumber('140-150 g/day')).toBe(140);
    expect(leadingNumber('3-4')).toBe(3);
    expect(leadingNumber('81,5')).toBe(81.5);
    expect(leadingNumber('')).toBeNull();
    expect(leadingNumber('n/a')).toBeNull();
  });
});

describe('bodyweightSlope', () => {
  const series = (start: string, kgs: number[], step = 1) =>
    kgs.map((kg, i) => ({ date: addDays(start, i * step), kg }));

  it('recovers a linear trend in kg/week', () => {
    const pts = series('2026-10-01', [80, 79.9, 79.8, 79.7, 79.6, 79.5, 79.4, 79.3]);
    expect(bodyweightSlope(pts, '2026-10-31')).toBeCloseTo(-0.7, 6);
  });

  it('uses only the last 14 weigh-ins up to the date', () => {
    const old = series('2026-08-01', Array(20).fill(90));
    const recent = series(
      '2026-09-01',
      Array(14)
        .fill(0)
        .map((_, i) => 80 + i * 0.1),
      2
    );
    expect(bodyweightSlope(old.concat(recent), '2026-12-01')).toBeCloseTo(0.35, 6);
    // Up to a date before the recent series, only the flat old series counts.
    expect(bodyweightSlope(old.concat(recent), '2026-08-31')).toBeCloseTo(0, 6);
  });

  it('needs ≥ 3 weigh-ins spanning ≥ 7 days', () => {
    expect(bodyweightSlope(series('2026-10-01', [80, 79]), '2026-10-31')).toBeNull();
    expect(
      bodyweightSlope(series('2026-10-01', [80, 79, 78, 77]), '2026-10-31')
    ).toBeNull();
    expect(
      bodyweightSlope(series('2026-10-01', [80, 79, 78], 4), '2026-10-31')
    ).not.toBeNull();
  });
});

describe('templateMacros', () => {
  it('mirrors the client: tags × grams/100, or × 1 without grams', () => {
    const tags = [
      { label: 'Protein', value: '20' },
      { label: 'Calories', value: '300' },
      { label: 'Carbs', value: '10' },
      { label: 'F', value: '5' },
    ];
    expect(templateMacros({ id: 'a', grams: 200, tags })).toEqual({
      protein: 40,
      calories: 600,
      carbs: 20,
      fat: 10,
    });
    expect(templateMacros({ id: 'a', grams: null, tags }).protein).toBe(20);
  });
});

describe('resolvePlan', () => {
  const days: PlanDay[] = [
    { id: 'd1', name: 'Push', weekdays: [], exercises: [{ sets: '3' }, { sets: '4-5' }] },
    { id: 'd2', name: 'Pull', weekdays: [], exercises: [{ sets: '3' }] },
  ];
  const withWeekdays: PlanDay[] = [
    Object.assign({}, days[0], { weekdays: [1, 4] }),
    Object.assign({}, days[1], { weekdays: [2, 5] }),
  ];

  it('weekdays fix the plan by calendar (Mon = Push, Sat = rest)', () => {
    expect(resolvePlan('2026-10-19', withWeekdays, [], null)).toMatchObject({
      plan: 'train',
      setsPlanned: 7,
      programDayId: 'd1',
      source: 'weekdays',
    });
    expect(resolvePlan('2026-10-17', withWeekdays, ['Push'], null)).toMatchObject({
      plan: 'rest',
      source: 'weekdays',
    });
  });

  it('without weekdays: a session means train with that day’s planned sets', () => {
    expect(resolvePlan('2026-10-17', days, ['pull'], null)).toMatchObject({
      plan: 'train',
      setsPlanned: 3,
      source: 'session',
    });
  });

  it('without weekdays: DailyLog.day "Rest" means rest, "Push" means train', () => {
    expect(resolvePlan('2026-10-17', days, ['Push'], 'Rest').plan).toBe('rest');
    expect(resolvePlan('2026-10-17', days, [], 'Push')).toMatchObject({
      plan: 'train',
      setsPlanned: 7,
      source: 'dailyLog',
    });
  });

  it('defaults to rest with no evidence of a planned session', () => {
    expect(resolvePlan('2026-10-17', null, [], null)).toMatchObject({
      plan: 'rest',
      source: 'default',
    });
  });
});

describe('scoreDay', () => {
  const facts: DayFacts = {
    tasksDone: 5,
    tasksTotal: 7,
    suppDone: 4,
    suppTotal: 4,
    mealsDone: 3,
    mealsTotal: 4,
    macros: { protein: 160, calories: 2500, carbs: 0, fat: 0 },
    setsDone: 12,
    sessionCount: 1,
    finishedSession: true,
    plan: { plan: 'train', setsPlanned: 15, programDayId: 'd1', source: 'session' },
    bwSlope: null,
    proteinTarget: 160,
    calorieTarget: 2500,
    goalRate: null,
  };

  it('keeps the old tick ratio as a separate routine %', () => {
    expect(routinePercent(facts)).toBe(80);
    const p = scoreDay(facts);
    expect(p.routinePct).toBe(80);
    expect(p.score).toBe(80);
    expect(p.outcomeScore).toBe(100);
    expect(p.kept).toBe(true);
    expect(p.workoutDone).toBe(true);
  });

  it('nothing eaten → unscored, legacy protein/calories 0', () => {
    const p = scoreDay(Object.assign({}, facts, { macros: null }));
    expect(p.outcomeScore).toBeNull();
    expect(p.kept).toBe(false);
    expect(p.protein).toBe(0);
  });
});
