import { describe, expect, it } from "vitest";
import {
  buildNutritionTargets,
  calorieTarget,
  computeMacroTargets,
  computeNutritionPlan,
  foodToMealTemplate,
  getGoalLabel,
  getGoalRateKgPerWeek,
  mifflinStJeor,
  proteinTargetGrams,
  targetWeight,
} from "../nutrition";
import type { LogEntry } from "../../types/appTypes";

// Oracles hand-computed from the published equations:
// Mifflin-St Jeor (1990): men 10w + 6.25h − 5a + 5; women … − 161.
// 80 kg, 180 cm, 30 y: 800 + 1125 − 150 = 1775 → men 1780, women 1614.
describe("Mifflin-St Jeor", () => {
  it("matches the published equation", () => {
    expect(
      mifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, sex: "male" })
    ).toBe(1780);
    expect(
      mifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, sex: "female" })
    ).toBe(1614);
    expect(
      mifflinStJeor({ weightKg: 60, heightCm: 165, ageYears: 45, sex: "female" })
    ).toBe(600 + 1031.25 - 225 - 161);
  });
});

describe("calorieTarget (audit 05 #1: goal used to be ignored)", () => {
  const body = { weightKg: 80, heightCm: 180, ageYears: 30, sex: "male" as const };
  it.each([
    // TDEE = 1780 × 1.55 = 2759
    ["cut", 2207], // × 0.80 = 2207.2
    ["bulk", 3035], // × 1.10 = 3034.9
    ["recomp", 2759],
    ["general", 2759],
    ["strength", 2897], // × 1.05 = 2896.95
  ])("80 kg/180 cm/30 y male, %s → %i kcal", (goal, kcal) => {
    const t = calorieTarget(Object.assign({ goal }, body));
    expect(t.method).toBe("msj");
    expect(t.tdee).toBe(2759);
    expect(t.calories).toBe(kcal);
  });

  it("cut and bulk are no longer the same number", () => {
    const cut = calorieTarget(Object.assign({ goal: "cut" }, body)).calories;
    const bulk = calorieTarget(Object.assign({ goal: "bulk" }, body)).calories;
    expect(bulk - cut).toBeGreaterThan(700);
  });

  it("custom activity factor", () => {
    expect(
      calorieTarget(Object.assign({ goal: "general", activityFactor: 1.2 }, body)).tdee
    ).toBe(2136);
  });

  it("falls back to 33 kcal/kg × goal factor without sex/height/age and says so", () => {
    const t = calorieTarget({ weightKg: 80, goal: "cut", ageYears: 30 });
    expect(t.method).toBe("bodyweight");
    expect(t.tdee).toBe(2640);
    expect(t.calories).toBe(2112); // 2640 × 0.8
    expect(t.note).toMatch(/33 kcal\/kg/);
    expect(t.note).toMatch(/Mifflin-St Jeor/);
  });

  it("adaptive TDEE wins over the formula", () => {
    const t = calorieTarget(Object.assign({ goal: "cut", adaptiveTdee: 3000 }, body));
    expect(t.method).toBe("adaptive");
    expect(t.calories).toBe(2400);
  });
});

describe("protein target (audit 05 #2, #3, #12)", () => {
  it("g/kg by goal within 1.6–2.2", () => {
    expect(proteinTargetGrams({ weightKg: 80, goal: "cut" }).grams).toBe(176); // 2.2
    expect(proteinTargetGrams({ weightKg: 80, goal: "bulk" }).grams).toBe(160); // 2.0
    expect(proteinTargetGrams({ weightKg: 80, goal: "strength" }).grams).toBe(144); // 1.8
    expect(proteinTargetGrams({ weightKg: 80, goal: "general" }).grams).toBe(128); // 1.6
  });

  it("an applied preference overrides the computed target when weight is set", () => {
    const t = proteinTargetGrams({ weightKg: 80, goal: "bulk", preference: "165 g/day" });
    expect(t).toMatchObject({ grams: 165, source: "preference" });
  });

  it("…but never below the 1.6 g/kg floor (110 g for 80 kg → 128 g)", () => {
    const t = proteinTargetGrams({ weightKg: 80, goal: "bulk", preference: "110 g/day" });
    expect(t.grams).toBe(128);
    expect(t.floor).toBe(128);
  });

  it("the schema default and g/kg strings are not overrides ('1.8-2.2 g/kg' ≠ 2 g)", () => {
    expect(
      proteinTargetGrams({ weightKg: 80, goal: "bulk", preference: "140-150 g/day" })
        .source
    ).toBe("goal");
    expect(
      proteinTargetGrams({ weightKg: 80, goal: "bulk", preference: "1.8-2.2 g/kg" }).grams
    ).toBe(160);
  });
});

const weighIn = (date: string, bw: number): LogEntry => ({
  date,
  day: "",
  bw: String(bw),
  sleep: "",
  steps: "",
  top: "",
  notes: "",
});

describe("bodyweight source (audit 05 #4)", () => {
  it("trend weight once ≥ 7 weigh-ins, else profile, else 70 kg reference", () => {
    const entries: LogEntry[] = [];
    for (let i = 0; i < 10; i++)
      entries.push(weighIn(`2026-09-${String(i + 1).padStart(2, "0")}`, 90 - i * 0.2));
    expect(targetWeight({ profileWeightKg: 95, logEntries: entries })).toEqual({
      kg: 88.2,
      source: "trend",
    });
    expect(
      targetWeight({ profileWeightKg: 95, logEntries: entries.slice(0, 6) }).source
    ).toBe("profile");
    expect(targetWeight({})).toEqual({ kg: 70, source: "reference" });
  });
});

describe("computeNutritionPlan / buildNutritionTargets", () => {
  it("no weight: real calories and macros from the 70 kg reference, not 0", () => {
    const targets = buildNutritionTargets(undefined, undefined, undefined, undefined);
    const macros = computeMacroTargets(targets);
    expect(macros.protein).toBe(112); // 70 × 1.6
    expect(macros.calories).toBe(2310); // 70 × 33
    expect(macros.carbs).toBeGreaterThan(0);
    expect(macros.fat).toBe(63);
    expect(targets.find((t) => t.k === "Goal")!.n).toMatch(/70 kg reference/);
  });

  it("80 kg cut, profile weight, no height: 2112 kcal, 176 g protein, carbs fill the rest", () => {
    const plan = computeNutritionPlan({ body: { profileWeightKg: 80 }, goal: "cut" });
    expect(plan.calories.calories).toBe(2112);
    expect(plan.proteinG).toBe(176);
    expect(plan.fatG).toBe(64);
    expect(plan.carbsG).toBe(Math.round((2112 - 176 * 4 - 64 * 9) / 4));
  });

  it("the calorie target in the list is absolute and read back exactly", () => {
    const targets = buildNutritionTargets(80, undefined, undefined, "bulk", {
      heightCm: 180,
      ageYears: 30,
      sex: "male",
    });
    expect(targets.find((t) => t.k === "Calories")!.v).toBe("3035 kcal/day");
    expect(computeMacroTargets(targets).calories).toBe(3035);
  });

  it("Apply adaptive protein changes the target (was a no-op)", () => {
    const before = computeMacroTargets(
      buildNutritionTargets(80, undefined, undefined, "bulk")
    );
    const after = computeMacroTargets(
      buildNutritionTargets(80, "175 g/day", undefined, "bulk")
    );
    expect(before.protein).toBe(160);
    expect(after.protein).toBe(175);
  });
});

describe("goal helpers", () => {
  it("labels and weekly rates", () => {
    expect(getGoalLabel("cut")).toBe("Cut");
    expect(getGoalLabel("nonsense")).toBe("General");
    expect(getGoalRateKgPerWeek("cut")).toBe(-0.4);
    expect(getGoalRateKgPerWeek(undefined)).toBe(0);
  });
});

describe("foodToMealTemplate", () => {
  const food = {
    id: "off_1",
    name: "Protein bar",
    brand: "Acme",
    caloriesPer100g: 380,
    proteinPer100g: 33,
    carbsPer100g: 40,
    fatPer100g: 10,
    fiberPer100g: null,
    sugarPer100g: null,
    sodiumMgPer100g: null,
    isVerified: false,
  };
  it("defaults to the product serving when known (audit 05 #13)", () => {
    const t = foodToMealTemplate(Object.assign({ servingGrams: 45 }, food));
    expect(t.grams).toBe(45);
    expect(t.examples).toBe("1 serving (45 g)");
    expect(t.name).toBe("Protein bar (Acme)");
  });
  it("100 g otherwise", () => {
    expect(foodToMealTemplate(food).grams).toBe(100);
  });
});
