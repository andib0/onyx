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

  // If no weight, build what we can from preferences
  if (!weight || weight <= 0) {
    const protein = proteinTarget || "1.8-2.2 g/kg";
    return [
      { k: "Goal", v: profile.label, n: profile.weightNote },
      { k: "Calories", v: profile.calories, n: profile.caloriesNote },
      { k: "Protein", v: protein, n: "Set your weight in profile for precise targets." },
      { k: "Hydration", v: hydration, n: "500 ml on wake; 500 ml pre-gym." },
    ];
  }

  // Compute from weight + goal profile
  const proteinLow = weight * profile.proteinPerKg[0];
  const proteinHigh = weight * profile.proteinPerKg[1];
  const fatLow = weight * profile.fatPerKg[0];
  const fatHigh = weight * profile.fatPerKg[1];

  // Estimate carbs from remaining calories (rough)
  // Using midpoint protein and fat to estimate remaining
  const proteinMid = (proteinLow + proteinHigh) / 2;
  const fatMid = (fatLow + fatHigh) / 2;
  const proteinCals = proteinMid * 4;
  const fatCals = fatMid * 9;
  // TDEE rough estimate: weight * 33 for moderate activity
  const tdeeEstimate = weight * 33;
  const carbCals = Math.max(0, tdeeEstimate - proteinCals - fatCals);
  const carbLow = Math.round((carbCals / 4) * 0.85);
  const carbHigh = Math.round((carbCals / 4) * 1.15);

  return [
    {
      k: "Goal",
      v: profile.label,
      n: profile.weightNote,
    },
    {
      k: "Calories",
      v: profile.calories,
      n: profile.caloriesNote,
    },
    {
      k: "Protein",
      v: rangeString(proteinLow, proteinHigh, "g/day"),
      n: `~${profile.proteinPerKg[0]}-${profile.proteinPerKg[1]} ${profile.proteinNote}`,
    },
    {
      k: "Fat",
      v: rangeString(fatLow, fatHigh, "g/day"),
      n: profile.fatNote,
    },
    {
      k: "Carbs",
      v: rangeString(carbLow, carbHigh, "g/day (est.)"),
      n: profile.carbsNote,
    },
    {
      k: "Hydration",
      v: hydration,
      n: "500 ml on wake; 500 ml pre-gym.",
    },
  ];
}

export function getGoalLabel(programGoal: string | undefined): string {
  if (programGoal && GOAL_PROFILES[programGoal]) {
    return GOAL_PROFILES[programGoal].label;
  }
  return "General";
}
