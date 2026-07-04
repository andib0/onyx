import { describe, expect, it } from "vitest";
import { parseSupplementQuickAdd } from "../quickParse";

describe("parseSupplementQuickAdd", () => {
  it("parses name + dose + am time", () => {
    expect(parseSupplementQuickAdd("Creatine 5g 8am")).toEqual({
      item: "Creatine",
      dose: "5g",
      timeAt: "08:00",
    });
  });

  it("parses pm and HH:MM times", () => {
    expect(parseSupplementQuickAdd("Magnesium 300mg 10pm").timeAt).toBe("22:00");
    expect(parseSupplementQuickAdd("Omega-3 2g 08:30").timeAt).toBe("08:30");
    expect(parseSupplementQuickAdd("Zinc 25mg 12am").timeAt).toBe("00:00");
  });

  it("handles multi-word names and 'at'", () => {
    expect(parseSupplementQuickAdd("Vitamin D3 2000iu at 9am")).toEqual({
      item: "Vitamin D3",
      dose: "2000iu",
      timeAt: "09:00",
    });
  });

  it("parses caps/tabs doses and decimal commas", () => {
    expect(parseSupplementQuickAdd("Ashwagandha 2 caps").dose).toBe("2caps");
    expect(parseSupplementQuickAdd("Melatonin 0,5 mg").dose).toBe("0.5mg");
  });

  it("name only when nothing else matches", () => {
    expect(parseSupplementQuickAdd("Creatine")).toEqual({
      item: "Creatine",
      dose: "",
      timeAt: "",
    });
  });

  it("does not eat numbers that are part of the name", () => {
    const r = parseSupplementQuickAdd("Omega 3");
    expect(r.dose).toBe("");
    expect(r.item).toBe("Omega 3");
  });
});
