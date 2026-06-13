import type { AppState, LogEntry, SupplementItem } from "../types/appTypes";

export type WeightPoint = { date: string; weightKg: number };

export type WeightTrend = {
  points: WeightPoint[];
  currentKg: number | null;
  weeklyRateKg: number | null;
};

export function dateKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

// Consecutive days (ending today, or yesterday if today not there yet) with
// score >= threshold, from snapshotted DailyScore rows merged with today's live.
export function scoreStreak(
  history: Array<{ date: string; score: number }>,
  todayKeyValue: string,
  todayScore: number,
  threshold = 80
): number {
  const map: Record<string, number> = {};
  for (const row of history) map[row.date] = row.score;
  map[todayKeyValue] = todayScore; // live value wins for today

  let streak = 0;
  // If today already qualifies, count from today; else start from yesterday
  const startOffset = (map[todayKeyValue] ?? 0) >= threshold ? 0 : 1;
  for (let daysAgo = startOffset; daysAgo <= 365; daysAgo++) {
    const score = map[dateKeyDaysAgo(daysAgo)];
    if (score === undefined || score < threshold) break;
    streak++;
  }
  return streak;
}

export type DayBar = { label: string; value: number };

// Last 7 days of bars from snapshotted scores (preferred over log-recompute)
export function scoreBarsFromHistory(
  history: Array<{ date: string; score: number }>
): DayBar[] {
  return last7Bars(history, (r) => r.score);
}

// Generic last-7-days bars from any dated history field
export function last7Bars<T extends { date: string }>(
  history: T[],
  pick: (row: T) => number
): DayBar[] {
  const map: Record<string, number> = {};
  for (const row of history) map[row.date] = pick(row);
  const bars: DayBar[] = [];
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const date = dateKeyDaysAgo(daysAgo);
    const weekday = new Date(date + "T00:00:00").getDay();
    bars.push({ label: DAY_INITIALS[weekday], value: map[date] ?? 0 });
  }
  return bars;
}

// Last 7 days (oldest→today) completion % across tasks + supplements + meals
export function buildWeeklyAdherence(
  appState: AppState,
  supplementsList: SupplementItem[]
): DayBar[] {
  const taskTotal = appState.schedule.length;
  const suppTotal = supplementsList.length;
  const bars: DayBar[] = [];
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const date = dateKeyDaysAgo(daysAgo);
    const completion = appState.completion[date] || {};
    const supps = appState.suppLog[date] || {};
    const meals = appState.mealLog[date] || {};
    const mealTotal = Object.keys(meals).length;
    const total = taskTotal + suppTotal + mealTotal;
    const done =
      Object.values(completion).filter(Boolean).length +
      Object.values(supps).filter(Boolean).length +
      Object.values(meals).filter(Boolean).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const weekday = new Date(date + "T00:00:00").getDay();
    bars.push({ label: DAY_INITIALS[weekday], value: pct });
  }
  return bars;
}

// Bodyweight points (last `windowDays`) plus weekly rate of change from a
// least-squares fit, so a single odd weigh-in doesn't dominate the rate.
export function buildWeightTrend(logEntries: LogEntry[], windowDays = 28): WeightTrend {
  const cutoff = dateKeyDaysAgo(windowDays);
  const points: WeightPoint[] = logEntries
    .filter((entry) => entry.date >= cutoff)
    .map((entry) => ({
      date: entry.date,
      weightKg: parseFloat(String(entry.bw).replace(",", ".")),
    }))
    .filter((p) => !isNaN(p.weightKg) && p.weightKg > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (points.length === 0) {
    return { points: [], currentKg: null, weeklyRateKg: null };
  }

  const currentKg = points[points.length - 1].weightKg;
  if (points.length < 3) {
    return { points, currentKg, weeklyRateKg: null };
  }

  const dayOf = (date: string) =>
    Math.floor(new Date(date + "T00:00:00").getTime() / 86400000);
  const xs = points.map((p) => dayOf(p.date));
  const ys = points.map((p) => p.weightKg);
  const n = points.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  const slopePerDay = den === 0 ? 0 : num / den;
  return { points, currentKg, weeklyRateKg: slopePerDay * 7 };
}

// -- Yesterday recap --

export type YesterdayRecap = {
  dateKey: string;
  blocksDone: number;
  blocksTotal: number;
  missedSupplements: string[];
  mealsEaten: number;
};

export function buildYesterdayRecap(
  appState: AppState,
  supplementsList: SupplementItem[]
): YesterdayRecap | null {
  const dateKey = dateKeyDaysAgo(1);
  const completion = appState.completion[dateKey] || {};
  const suppChecks = appState.suppLog[dateKey] || {};
  const mealChecks = appState.mealLog[dateKey] || {};

  const hasAnyData =
    Object.keys(completion).length > 0 ||
    Object.keys(suppChecks).length > 0 ||
    Object.keys(mealChecks).length > 0;
  if (!hasAnyData) return null;

  const blocksTotal = appState.schedule.length;
  const blocksDone = appState.schedule.reduce(
    (count, block) => (completion[block.id || ""] ? count + 1 : count),
    0
  );
  const missedSupplements = supplementsList
    .filter((s) => !suppChecks[s.id || ""])
    .map((s) => s.item);
  const mealsEaten = Object.values(mealChecks).filter(Boolean).length;

  return { dateKey, blocksDone, blocksTotal, missedSupplements, mealsEaten };
}

// Consecutive days (ending yesterday) where every supplement was taken.
// One grace miss per rolling 7 days keeps a single slip from nuking motivation.
export function supplementStreak(
  appState: AppState,
  supplementsList: SupplementItem[],
  maxDays = 365
): number {
  if (supplementsList.length === 0) return 0;
  let streak = 0;
  let graceLeft = 1;
  let daysSinceGraceRefill = 0;
  for (let daysAgo = 1; daysAgo <= maxDays; daysAgo++) {
    const checks = appState.suppLog[dateKeyDaysAgo(daysAgo)] || {};
    const allTaken = supplementsList.every((s) => checks[s.id || ""]);
    if (allTaken) {
      streak++;
    } else if (graceLeft > 0 && streak > 0) {
      graceLeft--;
    } else if (graceLeft > 0 && Object.keys(checks).length > 0) {
      graceLeft--;
    } else {
      break;
    }
    daysSinceGraceRefill++;
    if (daysSinceGraceRefill >= 7) {
      graceLeft = 1;
      daysSinceGraceRefill = 0;
    }
  }
  // Today counts too once everything is checked.
  const todayChecks = appState.suppLog[dateKeyDaysAgo(0)] || {};
  if (supplementsList.every((s) => todayChecks[s.id || ""])) streak++;
  return streak;
}
