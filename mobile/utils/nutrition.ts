import type { MealTemplate } from "../types/appTypes";
import type { Food } from "../api/foods";

type NutritionTarget = {
  k: string;
  v: string;
  n: string;
};

type GoalProfile = {
  label: string;
  calories: string;
  caloriesNote: string;
  proteinPerKg: [number, number];
  proteinNote: string;
  fatPerKg: [number, number];
  fatNote: string;
  carbsNote: string;
  weightNote: string;
};

const GOAL_PROFILES: Record<string, GoalProfile> = {
  bulk: {
    label: "Lean bulk",
    calories: "+200-300 kcal/day",
    caloriesNote: "Adjust weekly using scale + performance.",
    proteinPerKg: [1.8, 2.2],
    proteinNote: "g/kg for muscle gain in surplus.",
    fatPerKg: [0.8, 1.0],
    fatNote: "Avoid very high fat pre-gym if sluggish.",
    carbsNote: "Fuel training + cognition; prioritize earlier day.",
    weightNote: "Aim ~0.2-0.4 kg/week gain.",
  },
  cut: {
    label: "Cut",
    calories: "-300-500 kcal/day",
    caloriesNote: "Adjust weekly; prioritize protein to preserve muscle.",
    proteinPerKg: [2.0, 2.4],
    proteinNote: "g/kg to preserve muscle in deficit.",
    fatPerKg: [0.7, 0.9],
    fatNote: "Keep moderate for hormones; reduce carbs first.",
    carbsNote: "Lower than bulk; keep around training windows.",
    weightNote: "Aim ~0.3-0.5 kg/week loss.",
  },
  recomp: {
    label: "Recomp",
    calories: "Maintenance",
    caloriesNote: "Eat at maintenance; rely on training stimulus.",
    proteinPerKg: [1.8, 2.2],
    proteinNote: "g/kg to support muscle growth at maintenance.",
    fatPerKg: [0.8, 1.0],
    fatNote: "Moderate; keep consistent.",
    carbsNote: "Fill remaining; prioritize around training.",
    weightNote: "Maintain weight; body composition shifts over time.",
  },
  strength: {
    label: "Strength",
    calories: "+100-200 kcal/day",
    caloriesNote: "Slight surplus to fuel recovery and performance.",
    proteinPerKg: [1.6, 2.0],
    proteinNote: "g/kg for strength-focused training.",
    fatPerKg: [0.8, 1.0],
    fatNote: "Moderate; support joint health.",
    carbsNote: "Fuel heavy sessions; prioritize pre/post workout.",
    weightNote: "Slow gain OK; focus on performance.",
  },
  general: {
    label: "General fitness",
    calories: "Maintenance",
    caloriesNote: "Eat at maintenance; adjust if goals change.",
    proteinPerKg: [1.6, 2.0],
    proteinNote: "g/kg for general activity level.",
    fatPerKg: [0.8, 1.0],
    fatNote: "Moderate; balanced approach.",
    carbsNote: "Fill remaining; no strict limits.",
    weightNote: "Maintain weight; adjust based on goals.",
  },
};

const DEFAULT_GOAL = "general";

function rangeString(low: number, high: number, unit: string): string {
  return `${Math.round(low)}-${Math.round(high)} ${unit}`;
}

export function buildNutritionTargets(
  weight: number | undefined | null,
  proteinTarget: string | undefined,
  hydrationTarget: string | undefined,
  programGoal: string | undefined
): NutritionTarget[] {
  const goal = programGoal && GOAL_PROFILES[programGoal] ? programGoal : DEFAULT_GOAL;
  const profile = GOAL_PROFILES[goal];

  const hydration = hydrationTarget || ">=2.5 L/day";

  if (!weight || weight <= 0) {
    const protein = proteinTarget || "1.8-2.2 g/kg";
    return [
      { k: "Goal", v: profile.label, n: profile.weightNote },
      { k: "Calories", v: profile.calories, n: profile.caloriesNote },
      { k: "Protein", v: protein, n: "Set your weight in profile for precise targets." },
      { k: "Hydration", v: hydration, n: "500 ml on wake; 500 ml pre-gym." },
    ];
  }

  const proteinLow = weight * profile.proteinPerKg[0];
  const proteinHigh = weight * profile.proteinPerKg[1];
  const fatLow = weight * profile.fatPerKg[0];
  const fatHigh = weight * profile.fatPerKg[1];

  const proteinMid = (proteinLow + proteinHigh) / 2;
  const fatMid = (fatLow + fatHigh) / 2;
  const proteinCals = proteinMid * 4;
  const fatCals = fatMid * 9;
  const tdeeEstimate = weight * 33;
  const carbCals = Math.max(0, tdeeEstimate - proteinCals - fatCals);
  const carbLow = Math.round((carbCals / 4) * 0.85);
  const carbHigh = Math.round((carbCals / 4) * 1.15);

  return [
    { k: "Goal", v: profile.label, n: profile.weightNote },
    { k: "Calories", v: profile.calories, n: profile.caloriesNote },
    {
      k: "Protein",
      v: rangeString(proteinLow, proteinHigh, "g/day"),
      n: `~${profile.proteinPerKg[0]}-${profile.proteinPerKg[1]} ${profile.proteinNote}`,
    },
    { k: "Fat", v: rangeString(fatLow, fatHigh, "g/day"), n: profile.fatNote },
    {
      k: "Carbs",
      v: rangeString(carbLow, carbHigh, "g/day (est.)"),
      n: profile.carbsNote,
    },
    { k: "Hydration", v: hydration, n: "500 ml on wake; 500 ml pre-gym." },
  ];
}

export function getGoalLabel(programGoal: string | undefined): string {
  if (programGoal && GOAL_PROFILES[programGoal]) {
    return GOAL_PROFILES[programGoal].label;
  }
  return "General";
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

// Parse numeric macro targets from the target list; calories derived from macros
// (the calorie target string is relative, e.g. "+200-300 kcal/day").
export function computeMacroTargets(
  targets: Array<{ k: string; v: string }>
): MacroTargets {
  const find = (key: string) =>
    parseTargetNumber(targets.find((t) => t.k.toLowerCase().includes(key))?.v || "");
  const protein = find("protein");
  const carbs = find("carb");
  const fat = find("fat");
  const calories = protein && carbs && fat ? protein * 4 + carbs * 4 + fat * 9 : 0;
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

export function foodToMealTemplate(food: Food): MealTemplate {
  const tags: Array<{ label: string; value: string }> = [];
  if (food.proteinPer100g != null)
    tags.push({ label: "Protein", value: `${food.proteinPer100g}g` });
  if (food.carbsPer100g != null)
    tags.push({ label: "Carbs", value: `${food.carbsPer100g}g` });
  if (food.caloriesPer100g != null)
    tags.push({ label: "Cal", value: `${food.caloriesPer100g}` });
  if (food.fatPer100g != null) tags.push({ label: "Fat", value: `${food.fatPer100g}g` });
  return {
    id: `food_${food.id}_${Date.now()}`,
    name: food.name + (food.brand ? ` (${food.brand})` : ""),
    examples: "per 100g",
    grams: 100,
    tags,
  };
}
