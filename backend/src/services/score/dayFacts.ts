// Pure helpers that turn stored rows into Outcome Score inputs for one date.
// The DB access lives in score.service.ts; everything here is deterministic.
import { daysBetween, isoWeekday } from '../../utils/dates.js';
import { computeOutcomeScore, type OutcomeComponents } from './outcome.js';

/** First number in a free-text field: "140-150 g/day" → 140, "3-4" → 3. */
export function leadingNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /-?\d+(?:[.,]\d+)?/.exec(s);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Bodyweight trend
// ---------------------------------------------------------------------------

export interface WeighIn {
  date: string;
  kg: number;
}

export const BW_WINDOW = 14;

/**
 * kg/week OLS slope over the last 14 weigh-ins on or before `upTo`.
 * Needs ≥ 3 weigh-ins spanning ≥ 7 days; otherwise null (no trend yet).
 */
export function bodyweightSlope(weighIns: WeighIn[], upTo: string): number | null {
  const pts = weighIns
    .filter((w) => w.date <= upTo && Number.isFinite(w.kg) && w.kg > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-BW_WINDOW);
  if (pts.length < 3) return null;
  const first = pts[0].date;
  if (daysBetween(first, pts[pts.length - 1].date) < 7) return null;
  const xs = pts.map((p) => daysBetween(first, p.date));
  const ys = pts.map((p) => p.kg);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) * (xs[i] - mx);
  }
  if (sxx === 0) return null;
  return (sxy / sxx) * 7;
}

// ---------------------------------------------------------------------------
// Meals → macros (mirrors mobile utils/nutrition.ts computeConsumedMacros)
// ---------------------------------------------------------------------------

export interface MealForMacros {
  id: string;
  grams: number | null;
  tags: Array<{ label: string; value: string }>;
}

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

/** Macros of one template: tag values × grams/100 when grams > 0, else × 1. */
export function templateMacros(meal: MealForMacros): Macros {
  const totals: Macros = { protein: 0, carbs: 0, fat: 0, calories: 0 };
  const factor = meal.grams != null && meal.grams > 0 ? meal.grams / 100 : 1;
  for (const tag of meal.tags) {
    const label = tag.label.toLowerCase();
    const value = parseFloat(tag.value) || 0;
    if (label.includes('protein') || label === 'p') totals.protein += value * factor;
    else if (label.includes('carb') || label === 'c') totals.carbs += value * factor;
    else if (label.includes('fat') || label === 'f') totals.fat += value * factor;
    else if (label.includes('cal') || label === 'kcal') totals.calories += value * factor;
  }
  return totals;
}

export function sumMacros(list: Macros[]): Macros {
  const t: Macros = { protein: 0, carbs: 0, fat: 0, calories: 0 };
  for (const m of list) {
    t.protein += m.protein;
    t.carbs += m.carbs;
    t.fat += m.fat;
    t.calories += m.calories;
  }
  return t;
}

// ---------------------------------------------------------------------------
// Planned train / rest
// ---------------------------------------------------------------------------

export interface PlanDay {
  id: string;
  name: string;
  weekdays: number[];
  exercises: Array<{ sets: string }>;
}

export type PlanSource = 'weekdays' | 'session' | 'dailyLog' | 'default';

export interface PlanResult {
  plan: 'train' | 'rest';
  setsPlanned: number;
  programDayId: string | null;
  source: PlanSource;
}

export function plannedSets(day: PlanDay): number {
  return day.exercises.reduce((n, ex) => n + (leadingNumber(ex.sets) ?? 0), 0);
}

const sameName = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Planned train/rest for `date` (documented in docs/log/backend-sync-api.md):
 * 1. If the selected program has weekdays on any day, the plan is fixed by the
 *    calendar: train iff some program day lists the date's ISO weekday.
 * 2. Otherwise DailyLog.day = "Rest" means rest.
 * 3. Otherwise a WorkoutSession on that date means train (planned sets from the
 *    program day whose name matches the session's programDayName).
 * 4. Otherwise a non-empty DailyLog.day (e.g. "Push") means train.
 * 5. Otherwise rest.
 * The "selected program day" preference is deliberately not used: it is not
 * bound to a date, so a past day's plan would change with later selections.
 */
export function resolvePlan(
  date: string,
  programDays: PlanDay[] | null,
  sessionDayNames: Array<string | null>,
  dailyLogDay: string | null
): PlanResult {
  const days = programDays ?? [];
  if (days.some((d) => d.weekdays.length > 0)) {
    const wd = isoWeekday(date);
    const day = days.find((d) => d.weekdays.includes(wd));
    return day
      ? {
          plan: 'train',
          setsPlanned: plannedSets(day),
          programDayId: day.id,
          source: 'weekdays',
        }
      : { plan: 'rest', setsPlanned: 0, programDayId: null, source: 'weekdays' };
  }
  const logDay = dailyLogDay?.trim() ?? '';
  if (/^rest$/i.test(logDay)) {
    return { plan: 'rest', setsPlanned: 0, programDayId: null, source: 'dailyLog' };
  }
  if (sessionDayNames.length > 0) {
    const day =
      days.find((d) => sessionDayNames.some((n) => sameName(n, d.name))) ?? null;
    return {
      plan: 'train',
      setsPlanned: day ? plannedSets(day) : 0,
      programDayId: day?.id ?? null,
      source: 'session',
    };
  }
  if (logDay) {
    const day = days.find((d) => sameName(logDay, d.name)) ?? null;
    return {
      plan: 'train',
      setsPlanned: day ? plannedSets(day) : 0,
      programDayId: day?.id ?? null,
      source: 'dailyLog',
    };
  }
  return { plan: 'rest', setsPlanned: 0, programDayId: null, source: 'default' };
}

/**
 * "Mark done" (trained but didn't log): a session finished with the
 * `markedDone` flag, or — clients before the flag existed — a finished
 * session with no sets at all. Counts as the planned training (T = 1,
 * contracts/README.md).
 */
export function isMarkedDone(s: {
  markedDone?: boolean | null;
  endedAt: Date | string | null;
  _count?: { sets: number };
}): boolean {
  if (s.markedDone) return true;
  return s.endedAt !== null && s._count !== undefined && s._count.sets === 0;
}

// ---------------------------------------------------------------------------
// One day's facts → DailyScore payload
// ---------------------------------------------------------------------------

export interface DayFacts {
  tasksDone: number;
  tasksTotal: number;
  suppDone: number;
  suppTotal: number;
  mealsDone: number;
  mealsTotal: number;
  /** null when no meal was logged as eaten that day. */
  macros: Macros | null;
  setsDone: number;
  sessionCount: number;
  finishedSession: boolean;
  /** A session finished via "Mark done" (see isMarkedDone). */
  markedDone?: boolean;
  plan: PlanResult;
  bwSlope: number | null;
  proteinTarget: number | null;
  calorieTarget: number | null;
  goalRate: number | null;
}

export interface DayScorePayload {
  score: number;
  tasksDone: number;
  tasksTotal: number;
  suppDone: number;
  suppTotal: number;
  mealsDone: number;
  mealsTotal: number;
  workoutDone: boolean;
  protein: number;
  calories: number;
  outcomeScore: number | null;
  kept: boolean;
  routinePct: number | null;
  components: OutcomeComponents;
  plan: 'train' | 'rest';
  setsDone: number;
  setsPlanned: number;
}

/** The old "tick ratio": schedule + supplements + meals ticked ÷ total, 0..100. */
export function routinePercent(f: DayFacts): number | null {
  const total = f.tasksTotal + f.suppTotal + f.mealsTotal;
  if (total === 0) return null;
  return Math.round((100 * (f.tasksDone + f.suppDone + f.mealsDone)) / total);
}

export function scoreDay(f: DayFacts): DayScorePayload {
  const outcome = computeOutcomeScore({
    plan: f.plan.plan,
    setsDone: f.setsDone,
    setsPlanned: f.plan.setsPlanned,
    markedDone: f.markedDone ?? false,
    protein: f.macros ? f.macros.protein : null,
    proteinTarget: f.proteinTarget,
    calories: f.macros ? f.macros.calories : null,
    calorieTarget: f.calorieTarget,
    bwSlope: f.bwSlope,
    goalRate: f.goalRate,
  });
  const routinePct = routinePercent(f);
  return {
    score: routinePct ?? 0,
    tasksDone: f.tasksDone,
    tasksTotal: f.tasksTotal,
    suppDone: f.suppDone,
    suppTotal: f.suppTotal,
    mealsDone: f.mealsDone,
    mealsTotal: f.mealsTotal,
    workoutDone: f.finishedSession || f.setsDone > 0,
    protein: Math.max(0, Math.round(f.macros?.protein ?? 0)),
    calories: Math.max(0, Math.round(f.macros?.calories ?? 0)),
    outcomeScore: outcome.score,
    kept: outcome.kept,
    routinePct,
    components: outcome.components,
    plan: f.plan.plan,
    setsDone: f.setsDone,
    setsPlanned: f.plan.setsPlanned,
  };
}
