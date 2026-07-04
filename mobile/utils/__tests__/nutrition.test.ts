import { describe, expect, it } from "vitest";
import {
  computeConsumedMacros,
  computeMacroTargets,
  parseTargetNumber,
} from "../nutrition";
import type { MealTemplate } from "../../types/appTypes";

describe("parseTargetNumber", () => {
  it("returns the midpoint of a range", () => {
    expect(parseTargetNumber("126-154 g/day")).toBe(140);
  });

  it("returns a single number as-is", () => {
    expect(parseTargetNumber("150 g")).toBe(150);
  });

  it("returns 0 when no number present", () => {
    expect(parseTargetNumber("as needed")).toBe(0);
    expect(parseTargetNumber("")).toBe(0);
  });
});

describe("computeMacroTargets", () => {
  it("derives calories from macros (4/4/9)", () => {
    const targets = [
      { k: "Protein", v: "140 g/day" },
      { k: "Carbs", v: "300 g/day" },
      { k: "Fat", v: "80 g/day" },
    ];
    const t = computeMacroTargets(targets);
    expect(t.protein).toBe(140);
    expect(t.carbs).toBe(300);
    expect(t.fat).toBe(80);
    expect(t.calories).toBe(140 * 4 + 300 * 4 + 80 * 9);
  });

  it("reports 0 calories when any macro is missing", () => {
    const t = computeMacroTargets([{ k: "Protein", v: "140 g" }]);
    expect(t.calories).toBe(0);
  });
});

describe("computeConsumedMacros", () => {
  const meal = (id: string, grams: number | undefined): MealTemplate =>
    ({
      id,
      name: "Chicken",
      examples: "",
      grams,
      tags: [
        { label: "Protein", value: "31g" },
        { label: "Fat", value: "3.6g" },
        { label: "Cal", value: "165" },
      ],
    }) as MealTemplate;

  it("counts only checked meals", () => {
    const totals = computeConsumedMacros([meal("a", undefined), meal("b", undefined)], {
      a: true,
    });
    expect(totals.protein).toBe(31);
    expect(totals.calories).toBe(165);
  });

  it("scales per-100g values by grams", () => {
    const totals = computeConsumedMacros([meal("a", 200)], { a: true });
    expect(totals.protein).toBe(62);
    expect(totals.calories).toBe(330);
  });
});
