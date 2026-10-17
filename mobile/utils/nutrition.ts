import type { LogEntry, MealTemplate } from "../types/appTypes";
import type { Food } from "../api/foods";
import { trendWeightKg } from "./trends";

// Nutrition targets.
// - Energy: Mifflin-St Jeor BMR (Mifflin et al. 1990, Am J Clin Nutr 51(2):241)
//   × activity factor (default 1.55, "moderately active") ± goal delta
//   (cut −20 %, bulk +10 %, recomp/general 0; Aragon et al. 2017 ISSN stand,
//   JISSN 14:16 — rate-based deficits/surpluses). When sex/height/age are not
//   known, fall back to 33 kcal/kg × goal factor and say so.
// - After enough logged data, an adaptive TDEE (utils/adaptiveTargets.ts,
//   energy-balance back-calculation) replaces the formula, clamped ±25 %.
// - Protein: g/kg by goal within 1.6–2.2 with a hard floor of 1.6 g/kg (Morton
//   et al. 2018, Br J Sports Med 52:376: gains plateau ≈ 1.62 g/kg).
// - Bodyweight: the regression trend weight once ≥ 7 weigh-ins exist
//   (utils/trends.ts), else the profile weight.

type NutritionTarget = {
  k: string;
  v: string;
  n: string;
};

export type Goal = "bulk" | "cut" | "recomp" | "strength" | "general";
export type Sex = "male" | "female";

type GoalProfile = {
  label: string;
  calorieDelta: number; // fraction of TDEE
  proteinPerKg: number;
  fatPerKg: number;
  proteinNote: string;
  fatNote: string;
  carbsNote: string;
  weightNote: string;
  rateKgPerWeek: number;
};

const GOAL_PROFILES: Record<Goal, GoalProfile> = {
  bulk: {
    label: "Lean bulk",
    calorieDelta: 0.1,
    proteinPerKg: 2.0,
    fatPerKg: 0.9,
    proteinNote: "g/kg for muscle gain in a surplus.",
    fatNote: "Avoid very high fat pre-gym if sluggish.",
    carbsNote: "Fuel training + cognition; prioritize earlier day.",
    weightNote: "Aim ~0.2-0.4 kg/week gain.",
    rateKgPerWeek: 0.3,
  },
  cut: {
    label: "Cut",
    calorieDelta: -0.2,
    proteinPerKg: 2.2,
    fatPerKg: 0.8,
    proteinNote: "g/kg to preserve muscle in a deficit.",
    fatNote: "Keep moderate for hormones; reduce carbs first.",
    carbsNote: "Lower than bulk; keep around training windows.",
    weightNote: "Aim ~0.3-0.5 kg/week loss.",
    rateKgPerWeek: -0.4,
  },
  recomp: {
    label: "Recomp",
    calorieDelta: 0,
    proteinPerKg: 2.0,
    fatPerKg: 0.9,
    proteinNote: "g/kg to support muscle growth at maintenance.",
    fatNote: "Moderate; keep consistent.",
    carbsNote: "Fill remaining; prioritize around training.",
    weightNote: "Maintain weight; body composition shifts over time.",
    rateKgPerWeek: 0,
  },
  strength: {
    label: "Strength",
    calorieDelta: 0.05,
    proteinPerKg: 1.8,
    fatPerKg: 0.9,
    proteinNote: "g/kg for strength-focused training.",
    fatNote: "Moderate; support joint health.",
    carbsNote: "Fuel heavy sessions; prioritize pre/post workout.",
    weightNote: "Slow gain OK; focus on performance.",
    rateKgPerWeek: 0.15,
  },
  general: {
    label: "General fitness",
    calorieDelta: 0,
    proteinPerKg: 1.6,
    fatPerKg: 0.9,
    proteinNote: "g/kg for general activity level.",
    fatNote: "Moderate; balanced approach.",
    carbsNote: "Fill remaining; no strict limits.",
    weightNote: "Maintain weight; adjust based on goals.",
    rateKgPerWeek: 0,
  },
};

export const PROTEIN_FLOOR_G_PER_KG = 1.6;
export const DEFAULT_ACTIVITY_FACTOR = 1.55;
export const FALLBACK_KCAL_PER_KG = 33;
// No weight at all: a 70 kg reference adult (ICRP "reference man") so the
// app shows usable numbers instead of 0 — clearly labelled as such.
export const REFERENCE_WEIGHT_KG = 70;
export const DEFAULT_PROTEIN_PREF = "140-150 g/day";

function goalOf(programGoal: string | undefined): Goal {
  return programGoal && programGoal in GOAL_PROFILES ? (programGoal as Goal) : "general";
}

// Mifflin-St Jeor: 10·kg + 6.25·cm − 5·years + 5 (men) / − 161 (women).
export function mifflinStJeor(p: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
}): number {
  return (
    10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears + (p.sex === "male" ? 5 : -161)
  );
}

export type BodyInputs = {
  profileWeightKg?: number | null;
  logEntries?: LogEntry[];
  heightCm?: number | null;
  ageYears?: number | null;
  sex?: Sex | null;
  activityFactor?: number | null;
};

export type WeightSource = "trend" | "profile" | "reference";

export function targetWeight(b: BodyInputs): { kg: number; source: WeightSource } {
  const trend = b.logEntries ? trendWeightKg(b.logEntries) : null;
  if (trend !== null) return { kg: trend, source: "trend" };
  // Prisma Decimal may arrive as a string over JSON
  const profile = Number(b.profileWeightKg);
  if (isFinite(profile) && profile > 0) return { kg: profile, source: "profile" };
  return { kg: REFERENCE_WEIGHT_KG, source: "reference" };
}

export type CalorieTarget = {
  calories: number;
  tdee: number;
  method: "adaptive" | "msj" | "bodyweight";
  note: string;
};

// Calories for a goal. `adaptiveTdee` (from logged intake + weight trend) wins
// over the formula when present.
export function calorieTarget(p: {
  weightKg: number;
  goal: string | undefined;
  heightCm?: number | null;
  ageYears?: number | null;
  sex?: Sex | null;
  activityFactor?: number | null;
  adaptiveTdee?: number | null;
}): CalorieTarget {
  const profile = GOAL_PROFILES[goalOf(p.goal)];
  const factor = 1 + profile.calorieDelta;
  const activity = p.activityFactor && p.activityFactor > 1 ? p.activityFactor : null;
  const deltaText =
    profile.calorieDelta === 0
      ? "maintenance"
      : `${profile.calorieDelta > 0 ? "+" : "−"}${Math.round(Math.abs(profile.calorieDelta) * 100)}%`;

  if (p.adaptiveTdee && p.adaptiveTdee > 0) {
    return {
      calories: Math.round(p.adaptiveTdee * factor),
      tdee: Math.round(p.adaptiveTdee),
      method: "adaptive",
      note: `From your logged intake and weight trend (TDEE ${Math.round(p.adaptiveTdee)}), ${deltaText}.`,
    };
  }
  if (p.heightCm && p.ageYears && p.sex) {
    const bmr = mifflinStJeor({
      weightKg: p.weightKg,
      heightCm: p.heightCm,
      ageYears: p.ageYears,
      sex: p.sex,
    });
    const tdee = bmr * (activity ?? DEFAULT_ACTIVITY_FACTOR);
    return {
      calories: Math.round(tdee * factor),
      tdee: Math.round(tdee),
      method: "msj",
      note: `Mifflin-St Jeor BMR ${Math.round(bmr)} × ${activity ?? DEFAULT_ACTIVITY_FACTOR} activity, ${deltaText}.`,
    };
  }
  const tdee = p.weightKg * FALLBACK_KCAL_PER_KG;
  return {
    calories: Math.round(tdee * factor),
    tdee: Math.round(tdee),
    method: "bodyweight",
    note: `Estimate: ${FALLBACK_KCAL_PER_KG} kcal/kg, ${deltaText}. Add sex, height and age for Mifflin-St Jeor.`,
  };
}

// Applied preference ("165 g/day") overrides the computed protein target, but
// never below the floor. The schema default string means "not set".
export function proteinTargetGrams(p: {
  weightKg: number;
  goal: string | undefined;
  preference?: string | null;
}): { grams: number; floor: number; source: "goal" | "preference" } {
  const profile = GOAL_PROFILES[goalOf(p.goal)];
  const floor = Math.round(p.weightKg * PROTEIN_FLOOR_G_PER_KG);
  const pref = (p.preference || "").trim();
  if (pref && pref !== DEFAULT_PROTEIN_PREF && !/g\s*\/\s*kg/i.test(pref)) {
    const grams = parseTargetNumber(pref);
    if (grams > 0) return { grams: Math.max(grams, floor), floor, source: "preference" };
  }
  return {
    grams: Math.max(Math.round(p.weightKg * profile.proteinPerKg), floor),
    floor,
    source: "goal",
  };
}

export type NutritionPlan = {
  goal: Goal;
  weightKg: number;
  weightSource: WeightSource;
  calories: CalorieTarget;
  proteinG: number;
  proteinFloorG: number;
  proteinSource: "goal" | "preference";
  fatG: number;
  carbsG: number;
};

export function computeNutritionPlan(p: {
  body: BodyInputs;
  goal: string | undefined;
  proteinPreference?: string | null;
  adaptiveTdee?: number | null;
}): NutritionPlan {
  const goal = goalOf(p.goal);
  const profile = GOAL_PROFILES[goal];
  const w = targetWeight(p.body);
  const calories = calorieTarget({
    weightKg: w.kg,
    goal,
    heightCm: p.body.heightCm,
    ageYears: p.body.ageYears,
    sex: p.body.sex,
    activityFactor: p.body.activityFactor,
    adaptiveTdee: p.adaptiveTdee,
  });
  const protein = proteinTargetGrams({
    weightKg: w.kg,
    goal,
    preference: p.proteinPreference,
  });
  const fatG = Math.round(w.kg * profile.fatPerKg);
  const carbsG = Math.max(
    0,
    Math.round((calories.calories - protein.grams * 4 - fatG * 9) / 4)
  );
  return {
    goal,
    weightKg: w.kg,
    weightSource: w.source,
    calories,
    proteinG: protein.grams,
    proteinFloorG: protein.floor,
    proteinSource: protein.source,
    fatG,
    carbsG,
  };
}

const WEIGHT_SOURCE_NOTE: Record<WeightSource, string> = {
  trend: "Based on your weigh-in trend.",
  profile: "Based on your profile weight.",
  reference: "Set your weight for personal targets — using a 70 kg reference.",
};

export function buildNutritionTargets(
  weight: number | undefined | null,
  proteinTarget: string | undefined,
  hydrationTarget: string | undefined,
  programGoal: string | undefined,
  extras: {
    logEntries?: LogEntry[];
    heightCm?: number | null;
    ageYears?: number | null;
    sex?: Sex | null;
    activityFactor?: number | null;
    adaptiveTdee?: number | null;
  } = {}
): NutritionTarget[] {
  const plan = computeNutritionPlan({
    body: {
      profileWeightKg: weight ?? null,
      logEntries: extras.logEntries,
      heightCm: extras.heightCm,
      ageYears: extras.ageYears,
      sex: extras.sex,
      activityFactor: extras.activityFactor,
    },
    goal: programGoal,
    proteinPreference: proteinTarget,
    adaptiveTdee: extras.adaptiveTdee,
  });
  const profile = GOAL_PROFILES[plan.goal];
  const hydration = hydrationTarget || ">=2.5 L/day";
  const perKg = Math.round((plan.proteinG / plan.weightKg) * 10) / 10;

  return [
    {
      k: "Goal",
      v: profile.label,
      n: `${profile.weightNote} ${WEIGHT_SOURCE_NOTE[plan.weightSource]} (${plan.weightKg} kg)`,
    },
    { k: "Calories", v: `${plan.calories.calories} kcal/day`, n: plan.calories.note },
    {
      k: "Protein",
      v: `${plan.proteinG} g/day`,
      n:
        plan.proteinSource === "preference"
          ? `Your applied target (≈${perKg} g/kg; floor ${plan.proteinFloorG} g).`
          : `~${perKg} ${profile.proteinNote} Floor ${PROTEIN_FLOOR_G_PER_KG} g/kg.`,
    },
    { k: "Fat", v: `${plan.fatG} g/day`, n: profile.fatNote },
    { k: "Carbs", v: `${plan.carbsG} g/day`, n: profile.carbsNote },
    { k: "Hydration", v: hydration, n: "500 ml on wake; 500 ml pre-gym." },
  ];
}

export function getGoalLabel(programGoal: string | undefined): string {
  if (programGoal && programGoal in GOAL_PROFILES) {
    return GOAL_PROFILES[programGoal as Goal].label;
  }
  return "General";
}

// Target bodyweight change in kg/week per goal — midpoints of each profile's
// weightNote (cut 0.3–0.5 loss, bulk 0.2–0.4 gain). Outcome Score Bw input.
export function getGoalRateKgPerWeek(programGoal: string | undefined): number {
  return GOAL_PROFILES[goalOf(programGoal)].rateKgPerWeek;
}

// -- Consumed macros from checked meals --

export type ConsumedMacros = {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
};

// Tag values on food-based templates are per 100g; scale by grams when set.
export function computeConsumedMacros(
  meals: MealTemplate[],
  checkMap: Record<string, boolean>
): ConsumedMacros {
  const totals: ConsumedMacros = { protein: 0, carbs: 0, fat: 0, calories: 0 };
  for (const meal of meals) {
    if (!checkMap[meal.id || ""]) continue;
    const factor = meal.grams != null && meal.grams > 0 ? meal.grams / 100 : 1;
    for (const tag of meal.tags || []) {
      const label = tag.label.toLowerCase();
      const value = parseFloat(tag.value) || 0;
      if (label.includes("protein") || label === "p") totals.protein += value * factor;
      else if (label.includes("carb") || label === "c") totals.carbs += value * factor;
      else if (label.includes("fat") || label === "f") totals.fat += value * factor;
      else if (label.includes("cal") || label === "kcal")
        totals.calories += value * factor;
    }
  }
  return totals;
}

export type MacroTargets = {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
};

// Numeric macro targets from the target list. An absolute "N kcal/day" calorie
// target wins; otherwise calories derive from the macros (4/4/9).
export function computeMacroTargets(
  targets: Array<{ k: string; v: string }>
): MacroTargets {
  const entry = (key: string) => targets.find((t) => t.k.toLowerCase().includes(key));
  const find = (key: string) => parseTargetNumber(entry(key)?.v || "");
  const protein = find("protein");
  const carbs = find("carb");
  const fat = find("fat");
  const calorieText = entry("calorie")?.v || "";
  const absolute = /^\s*\d/.test(calorieText) && /kcal/i.test(calorieText);
  const calories = absolute
    ? parseTargetNumber(calorieText)
    : protein && carbs && fat
      ? protein * 4 + carbs * 4 + fat * 9
      : 0;
  return { protein, carbs, fat, calories };
}

// "126-154 g/day" -> 140 (midpoint); "150 g" -> 150; no number -> 0
export function parseTargetNumber(value: string): number {
  const matches = String(value || "").match(/\d+(\.\d+)?/g);
  if (!matches || matches.length === 0) return 0;
  if (matches.length >= 2) {
    return Math.round((Number(matches[0]) + Number(matches[1])) / 2);
  }
  return Math.round(Number(matches[0]));
}

// -- Food-to-MealTemplate conversion --

// `servingGrams` (e.g. a barcode product's serving) sets the default portion;
// otherwise 100 g. Tag values stay per 100 g and are scaled by `grams`.
export function foodToMealTemplate(
  food: Food & { servingGrams?: number | null }
): MealTemplate {
  const tags: Array<{ label: string; value: string }> = [];
  if (food.proteinPer100g != null)
    tags.push({ label: "Protein", value: `${food.proteinPer100g}g` });
  if (food.carbsPer100g != null)
    tags.push({ label: "Carbs", value: `${food.carbsPer100g}g` });
  if (food.caloriesPer100g != null)
    tags.push({ label: "Cal", value: `${food.caloriesPer100g}` });
  if (food.fatPer100g != null) tags.push({ label: "Fat", value: `${food.fatPer100g}g` });
  const grams =
    food.servingGrams != null && food.servingGrams > 0
      ? Math.round(food.servingGrams * 10) / 10
      : 100;
  return {
    id: `food_${food.id}_${Date.now()}`,
    name: food.name + (food.brand ? ` (${food.brand})` : ""),
    examples: grams === 100 ? "per 100g" : `1 serving (${grams} g)`,
    grams,
    tags,
  };
}
