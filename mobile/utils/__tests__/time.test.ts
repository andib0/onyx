import { describe, expect, it } from "vitest";
import { toMinutes, getCurrentNextBlocks } from "../time";
import type { ScheduleBlock } from "../../types/appTypes";

const block = (id: string, start: string, end: string): ScheduleBlock =>
  ({
    id,
    start,
    end,
    title: id,
    purpose: "",
    good: "",
    tag: "",
    readonly: false,
    source: "schedule",
  }) as ScheduleBlock;

describe("toMinutes", () => {
  it("converts HH:MM", () => {
    expect(toMinutes("07:30")).toBe(450);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("tolerates malformed input", () => {
    expect(toMinutes("bad")).toBe(0);
  });
});

describe("getCurrentNextBlocks", () => {
  const schedule = [
    block("a", "07:00", "08:00"),
    block("b", "09:00", "10:00"),
    block("c", "12:00", "13:00"),
  ];

  it("returns current and next when inside a block", () => {
    const result = getCurrentNextBlocks(schedule, toMinutes("07:30"));
    expect(result.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("returns upcoming block when between blocks", () => {
    const result = getCurrentNextBlocks(schedule, toMinutes("08:30"));
    expect(result.map((b) => b.id)).toEqual(["b", "c"]);
  });

  it("returns the last block after the day ends", () => {
    const result = getCurrentNextBlocks(schedule, toMinutes("14:00"));
    expect(result.map((b) => b.id)).toEqual(["c"]);
  });

  it("returns empty for an empty schedule", () => {
    expect(getCurrentNextBlocks([], 600)).toEqual([]);
  });
});
