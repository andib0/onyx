import { describe, expect, it } from "vitest";
import {
  canonicalExerciseName,
  exerciseEquipment,
  exerciseKey,
  findExercise,
} from "../exerciseNames";
import { EXERCISE_CATALOG } from "../../data/exerciseCatalog";
import { programs } from "../../../backend/prisma/seed/programs";
import { exercises as libraryExercises } from "../../../backend/prisma/seed/exercises";

describe("canonicalExerciseName", () => {
  it.each([
    ["Bench Press", "Barbell Bench Press"],
    ["Barbell Bench Press", "Barbell Bench Press"],
    ["bench press", "Barbell Bench Press"],
    ["Flat Barbell Bench Press", "Barbell Bench Press"],
    ["  BENCH   PRESS ", "Barbell Bench Press"],
    ["Squats", "Back Squat"],
    ["Barbell Squats", "Back Squat"],
    ["Barbell Rows", "Barbell Row"],
    ["Cable Flyes", "Cable Fly"],
    ["Lat Pulldowns", "Lat Pulldown"],
    ["Weighted Pull-ups", "Weighted Pull-Up"],
    ["pull ups", "Pull-Up"],
    ["Tricep Pushdowns", "Triceps Pushdown"],
    ["DB Row", "Dumbbell Row"],
    ["Calf Raises (Seated)", "Seated Calf Raise"],
  ])("%s → %s", (input, expected) => {
    expect(canonicalExerciseName(input)).toBe(expected);
  });

  it("keeps unknown (custom) names, whitespace-trimmed", () => {
    expect(canonicalExerciseName("  Zercher   Carry ")).toBe("Zercher Carry");
    expect(findExercise("Zercher Carry")).toBeNull();
  });

  it("is idempotent", () => {
    for (const ex of EXERCISE_CATALOG) {
      expect(canonicalExerciseName(canonicalExerciseName(ex.name))).toBe(ex.name);
    }
  });

  it("no alias key collides across two catalogue entries", () => {
    const owner = new Map<string, string>();
    for (const ex of EXERCISE_CATALOG) {
      for (const label of [ex.name].concat(ex.aliases ?? [])) {
        const key = exerciseKey(label);
        const prev = owner.get(key);
        if (prev) expect(prev).toBe(ex.name);
        owner.set(key, ex.name);
      }
    }
  });

  it("every name in the seeded programs resolves to the library (audit 05 #10: was 35/42 unmatched)", () => {
    const unmatched: string[] = [];
    for (const p of programs)
      for (const d of p.days)
        for (const e of d.exercises)
          if (!findExercise(e.exerciseName)) unmatched.push(e.exerciseName);
    expect(unmatched).toEqual([]);
  });

  it("seeded programs use the exact canonical library names", () => {
    const library = new Set(libraryExercises.map((e) => e.name));
    const notCanonical: string[] = [];
    for (const p of programs)
      for (const d of p.days)
        for (const e of d.exercises)
          if (!library.has(e.exerciseName)) notCanonical.push(e.exerciseName);
    expect(notCanonical).toEqual([]);
  });

  it("every client catalogue entry exists in the server library", () => {
    const library = new Set(libraryExercises.map((e) => e.name));
    expect(
      EXERCISE_CATALOG.filter((e) => !library.has(e.name)).map((e) => e.name)
    ).toEqual([]);
  });

  it("the client catalogue mirrors the server library (name + equipment)", () => {
    for (const lib of libraryExercises) {
      const hit = findExercise(lib.name);
      expect(hit?.name, lib.name).toBe(lib.name);
      expect(hit?.equipment, lib.name).toBe(lib.equipment);
    }
  });
});

describe("exerciseEquipment", () => {
  it("reads the library, falls back to name cues for custom lifts", () => {
    expect(exerciseEquipment("Incline Dumbbell Press")).toBe("Dumbbell");
    expect(exerciseEquipment("Leg Press")).toBe("Machine");
    expect(exerciseEquipment("Cable Lateral Raise")).toBe("Cable");
    expect(exerciseEquipment("Smith Machine Squat")).toBe("Machine");
    expect(exerciseEquipment("Landmine Press")).toBeNull();
  });
});
