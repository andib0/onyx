import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { multiRemove: vi.fn(async () => {}) },
}));

import {
  MEAL_DAYS,
  addMinutesToTime,
  createNutritionBlocks,
  createProgramBlocks,
  formatMinutes,
  getMealTemplatesForDay,
  normalizeState,
} from "../normalize";
import type { MealTemplate, ScheduleBlock } from "../../types/appTypes";

const block = (patch: Partial<ScheduleBlock>): ScheduleBlock =>
  Object.assign(
    { start: "08:00", end: "09:00", title: "", purpose: "", good: "", tag: "" },
    patch
  );

describe("normalizeState", () => {
  it("fills every weekday, ids meals, defaults supplement time", () => {
    const state = normalizeState({
      supplementsList: [{ item: "Creatine", goal: "", dose: "5g", timeAt: "" }],
      mealTemplatesByDay: {
        Monday: [{ name: "Oats", examples: "", tags: [{ label: "P", value: "10" }] }],
      },
    });
    expect(Object.keys(state.mealTemplatesByDay)).toEqual(MEAL_DAYS);
    expect(state.mealTemplatesByDay.Monday[0].id).toBe("meal_Monday_0");
    expect(state.mealTemplatesByDay.Sunday).toEqual([]);
    expect(state.supplementsList[0].timeAt).toBe("08:00");
    expect(state.schedule).toEqual([]);
  });

  it("tolerates garbage input", () => {
    const state = normalizeState({} as never);
    expect(state.log).toEqual([]);
    expect(getMealTemplatesForDay("Monday", state)).toEqual([]);
  });
});

describe("time helpers", () => {
  it("formats and adds minutes, capped at 23:59", () => {
    expect(formatMinutes(75)).toBe("01:15");
    expect(addMinutesToTime("08:30", 45)).toBe("09:15");
    expect(addMinutesToTime("23:30", 120)).toBe("23:59");
  });
});

describe("createProgramBlocks", () => {
  const schedule = [
    block({ start: "17:00", end: "17:15", title: "Warm-up", tag: "Training" }),
    block({ start: "18:30", end: "19:00", title: "Dinner", tag: "Nutrition" }),
  ];
  it("slots the session between the warm-up and the next block", () => {
    const [b] = createProgramBlocks(schedule, "PPL - Push", true);
    expect(b).toMatchObject({
      start: "17:15",
      end: "18:30",
      tag: "Program",
      readonly: true,
    });
    expect(b.id).toBe("program_PPL_Push");
  });
  it("none on rest days or without a training block", () => {
    expect(createProgramBlocks(schedule, "x", false)).toEqual([]);
    expect(createProgramBlocks([schedule[1]], "x", true)).toEqual([]);
  });
});

describe("createNutritionBlocks", () => {
  it("pairs nutrition slots with meal templates", () => {
    const meals: MealTemplate[] = [
      {
        id: "m1",
        name: "Lunch",
        examples: "rice",
        tags: [{ label: "Protein", value: "40g" }],
      },
    ];
    const blocks = createNutritionBlocks(
      [block({ start: "12:00", end: "12:30", tag: "Nutrition" })],
      meals
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      title: "Lunch",
      good: "Protein 40g",
      source: "nutrition",
    });
    expect(createNutritionBlocks([], meals)).toEqual([]);
  });
});
