import { describe, expect, it } from "vitest";
import { uuidv4 } from "../uuid";
import { normalizeState } from "../normalize";

describe("uuidv4", () => {
  it("is RFC 4122 v4 shaped and unique", () => {
    const ids = new Set(Array.from({ length: 200 }, () => uuidv4()));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    }
  });
});

describe("normalizeState one-off foods", () => {
  it("keeps date-keyed (one-off) templates next to the weekday plan, drops junk keys", () => {
    const state = normalizeState({
      mealTemplatesByDay: {
        Monday: [{ id: "m", name: "Oats", examples: "", tags: [] }],
        "2026-10-19": [{ id: "o", name: "Chicken", examples: "", tags: [], grams: 150 }],
        training: [{ id: "x", name: "Legacy", examples: "", tags: [] }],
      },
    });
    expect(state.mealTemplatesByDay["2026-10-19"].map((m) => m.id)).toEqual(["o"]);
    expect(state.mealTemplatesByDay.Monday).toHaveLength(1);
    expect(state.mealTemplatesByDay.training).toBeUndefined();
  });
});
