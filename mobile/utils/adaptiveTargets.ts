import type { DailyScore } from "../api/scores";
import type { LogEntry } from "../types/appTypes";
import {
  PROTEIN_FLOOR_G_PER_KG,
  buildNutritionTargets,
  computeNutritionPlan,
  type Sex,
} from "./nutrition";

// ---------------------------------------------------------------------------
// Adaptive protein suggestion
// ---------------------------------------------------------------------------

export type ProteinSuggestion = {
  avg: number; // rounded average daily protein over the window
  suggested: number; // recommended target (nearest 5g, never below the floor)
  current: number; // current target
  direction: "raise" | "lower";
  days: number; // sample size
};

const WINDOW = 14;
const MIN_DAYS = 7;
const DEVIATION = 0.12; // 12% gap before suggesting a change

// Suggest a more realistic protein target from what the user actually eats,
// over completed days only (today is still partial). The suggestion never
// goes below 1.6 g/kg (Morton et al. 2018) when the weight is known — under-
// eating is a reason to help close the gap, not to lower the bar (audit 05 #3).
export function suggestProteinTarget(
  scoreHistory: DailyScore[],
  currentTarget: number,
  opts: { todayKey?: string; weightKg?: number | null } = {}
): ProteinSuggestion | null {
  if (!currentTarget || currentTarget <= 0) return null;

  const recent = scoreHistory
    .filter((s) => !opts.todayKey || s.date < opts.todayKey)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-WINDOW)
    .map((s) => s.protein)
    .filter((p) => typeof p === "number" && p > 0);

  if (recent.length < MIN_DAYS) return null;

  const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  const gap = Math.abs(avg - currentTarget) / currentTarget;
  if (gap < DEVIATION) return null;

  const floor =
    opts.weightKg && opts.weightKg > 0
      ? Math.ceil((opts.weightKg * PROTEIN_FLOOR_G_PER_KG) / 5) * 5
      : 5;
  const suggested = Math.max(floor, Math.round(avg / 5) * 5);
  if (suggested === currentTarget) return null;
  // Lowering only makes sense down to the floor; at/below it, nothing to offer
  if (suggested < currentTarget && currentTarget <= floor) return null;

  return {
    avg,
    suggested,
    current: currentTarget,
    direction: suggested > currentTarget ? "raise" : "lower",
    days: recent.length,
  };
}

// ---------------------------------------------------------------------------
// Adaptive TDEE — energy-balance back-calculation (the MacroFactor / Hall
// approach): over a window, energy in − energy out = stored energy, with
// ≈ 7700 kcal per kg of bodyweight change (Wishnofsky 1958; Hall 2008).
//   TDEE ≈ mean daily intake − 7700 · (weekly weight change) / 7
// Requires ≥ 14 days of span and ≥ 10 days with logged intake; today is
// excluded (partial). Clamped to ±25 % of the formula TDEE so a few
// unlogged snacks can't produce an absurd target.
// ---------------------------------------------------------------------------

export const KCAL_PER_KG = 7700;
export const ADAPTIVE_MIN_SPAN_DAYS = 14;
export const ADAPTIVE_MIN_INTAKE_DAYS = 10;
export const ADAPTIVE_CLAMP = 0.25;

export type AdaptiveTdee = {
  tdee: number;
  rawTdee: number;
  avgIntake: number;
  weeklyChangeKg: number;
  intakeDays: number;
  clamped: boolean;
};

const dayIndex = (date: string) => Math.floor(Date.parse(date + "T00:00:00Z") / 86400000);

export function adaptiveTdee(p: {
  intake: Array<{ date: string; calories: number }>;
  weighIns: LogEntry[] | Array<{ date: string; weightKg: number }>;
  formulaTdee: number;
  todayKey: string;
  windowDays?: number;
}): AdaptiveTdee | null {
  const windowDays = p.windowDays ?? 28;
  const end = dayIndex(p.todayKey); // exclusive: today is partial
  const start = end - windowDays;
  const inWindow = (date: string) => {
    const d = dayIndex(date);
    return d >= start && d < end;
  };

  const intake = p.intake.filter((r) => inWindow(r.date) && r.calories > 0);
  if (intake.length < ADAPTIVE_MIN_INTAKE_DAYS) return null;

  const weights = (p.weighIns as Array<Record<string, unknown>>)
    .map((r) => ({
      date: String(r.date),
      kg:
        typeof r.weightKg === "number"
          ? r.weightKg
          : parseFloat(String(r.bw ?? "").replace(",", ".")),
    }))
    .filter((r) => inWindow(r.date) && isFinite(r.kg) && r.kg > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (weights.length < 2) return null;
  // Weigh-ins must cover ≥ 14 calendar days for a meaningful trend
  const span = dayIndex(weights[weights.length - 1].date) - dayIndex(weights[0].date);
  if (span + 1 < ADAPTIVE_MIN_SPAN_DAYS) return null;

  // OLS slope of weight vs day → kg/week (robust to single noisy weigh-ins)
  const xs = weights.map((w) => dayIndex(w.date));
  const ys = weights.map((w) => w.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const weeklyChangeKg = den === 0 ? 0 : (num / den) * 7;

  const avgIntake = intake.reduce((a, r) => a + r.calories, 0) / intake.length;
  const rawTdee = avgIntake - (KCAL_PER_KG * weeklyChangeKg) / 7;
  const lo = p.formulaTdee * (1 - ADAPTIVE_CLAMP);
  const hi = p.formulaTdee * (1 + ADAPTIVE_CLAMP);
  const tdee = p.formulaTdee > 0 ? Math.min(Math.max(rawTdee, lo), hi) : rawTdee;
  return {
    tdee: Math.round(tdee),
    rawTdee: Math.round(rawTdee),
    avgIntake: Math.round(avgIntake),
    weeklyChangeKg: Math.round(weeklyChangeKg * 1000) / 1000,
    intakeDays: intake.length,
    clamped: Math.round(tdee) !== Math.round(rawTdee),
  };
}

// ---------------------------------------------------------------------------
// Full target resolution: formula plan → adaptive TDEE (when the data allows)
// → the displayed target list. Pure; DataContext calls it.
// ---------------------------------------------------------------------------

export function resolveNutritionTargets(p: {
  profileWeightKg: number | null | undefined;
  proteinPreference: string | undefined;
  hydrationTarget: string | undefined;
  goal: string | undefined;
  logEntries: LogEntry[];
  scoreHistory: Array<{ date: string; calories: number }>;
  todayKey: string;
  ageYears?: number | null;
  heightCm?: number | null;
  sex?: Sex | null;
}) {
  const body = {
    profileWeightKg: p.profileWeightKg ?? null,
    logEntries: p.logEntries,
    ageYears: p.ageYears ?? null,
    heightCm: p.heightCm ?? null,
    sex: p.sex ?? null,
  };
  const formula = computeNutritionPlan({ body, goal: p.goal });
  const adaptive = adaptiveTdee({
    intake: p.scoreHistory,
    weighIns: p.logEntries,
    formulaTdee: formula.calories.tdee,
    todayKey: p.todayKey,
  });
  return buildNutritionTargets(
    p.profileWeightKg,
    p.proteinPreference,
    p.hydrationTarget,
    p.goal,
    Object.assign({}, body, { adaptiveTdee: adaptive ? adaptive.tdee : null })
  );
}
