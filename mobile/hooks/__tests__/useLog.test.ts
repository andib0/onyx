import { describe, expect, it, vi } from "vitest";

vi.mock("../../sync/runtime", () => ({ enqueueWrite: async () => {} }));

import { changedLogFields } from "../useLog";

const entry = (o: Partial<Record<string, string>>) =>
  Object.assign(
    { date: "2026-10-17", day: "", bw: "", sleep: "", steps: "", top: "", notes: "" },
    o
  );

describe("changedLogFields (field-level daily log saves)", () => {
  it("sends only the fields that were entered and differ", () => {
    expect(changedLogFields(entry({ bw: "80.1" }), entry({ sleep: "7.0" }))).toEqual({
      sleep: "7.0",
    });
  });
  it("a blank field never clears an earlier value (form resets after save)", () => {
    expect(changedLogFields(entry({ bw: "80.1", sleep: "7" }), entry({}))).toEqual({});
  });
  it("first entry of the day sends every filled field", () => {
    expect(changedLogFields(undefined, entry({ bw: "80", day: "Push" }))).toEqual({
      day: "Push",
      bw: "80",
    });
  });
});
