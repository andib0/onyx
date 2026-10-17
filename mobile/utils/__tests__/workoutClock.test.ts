import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EMPTY_TIMING,
  restSecondsRemainingAt,
  sessionSecondsAt,
  workoutCountsAsDone,
} from "../workoutClock";
import { computeOutcomeScore } from "../outcomeScore";

const t0 = 1_000_000;
const timing = (patch: Partial<typeof EMPTY_TIMING>) =>
  Object.assign({}, EMPTY_TIMING, { sessionStartedAt: t0 }, patch);

describe("sessionSecondsAt", () => {
  it("elapsed minus pauses; frozen while paused and after finish", () => {
    expect(sessionSecondsAt(EMPTY_TIMING, t0 + 5000)).toBe(0);
    expect(sessionSecondsAt(timing({}), t0 + 65_400)).toBe(65);
    expect(sessionSecondsAt(timing({ pausedAccumMs: 5000 }), t0 + 65_000)).toBe(60);
    const paused = timing({ pauseStartedAt: t0 + 30_000 });
    expect(sessionSecondsAt(paused, t0 + 40_000)).toBe(30);
    expect(sessionSecondsAt(paused, t0 + 90_000)).toBe(30);
    const done = timing({ finishedAt: t0 + 3_600_000 });
    expect(sessionSecondsAt(done, t0 + 9_999_999)).toBe(3600);
  });
});

describe("restSecondsRemainingAt", () => {
  it("counts down to 0 and freezes while paused", () => {
    const rest = timing({ restEndsAt: t0 + 90_000 });
    expect(restSecondsRemainingAt(rest, t0)).toBe(90);
    expect(restSecondsRemainingAt(rest, t0 + 89_001)).toBe(1);
    expect(restSecondsRemainingAt(rest, t0 + 120_000)).toBe(0);
    expect(restSecondsRemainingAt(timing({ pausedRestRemainingMs: 42_500 }), t0)).toBe(
      43
    );
    expect(restSecondsRemainingAt(EMPTY_TIMING, t0)).toBe(0);
  });
});

describe("workoutCountsAsDone matches the score's T component", () => {
  it("≥ 80% of planned sets counts as done", () => {
    expect(workoutCountsAsDone(12, 15)).toBe(true);
    expect(workoutCountsAsDone(11, 15)).toBe(false);
    expect(workoutCountsAsDone(4, 5)).toBe(true);
    expect(workoutCountsAsDone(2, 3)).toBe(false);
    expect(workoutCountsAsDone(1, 0)).toBe(true);
    expect(workoutCountsAsDone(0, 0)).toBe(false);
  });

  it("agrees with T ≥ 1 for every done/planned pair up to 30 sets", () => {
    for (let planned = 1; planned <= 30; planned++)
      for (let done = 0; done <= planned; done++) {
        const T = computeOutcomeScore({
          plan: "train",
          setsDone: done,
          setsPlanned: planned,
          protein: 1,
          proteinTarget: 1,
        }).components.T!;
        expect(workoutCountsAsDone(done, planned)).toBe(T >= 1);
      }
  });

  it("contract vector '80% of sets counts as full training' is done", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const contract = JSON.parse(
      readFileSync(resolve(here, "../../../contracts/score-vectors.json"), "utf8")
    );
    const v = contract.vectors.find((x: { name: string }) => x.name.startsWith("80%"));
    expect(workoutCountsAsDone(v.input.setsDone, v.input.setsPlanned)).toBe(true);
  });
});
