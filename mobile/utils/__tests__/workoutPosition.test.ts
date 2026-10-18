import { describe, expect, it } from "vitest";
import {
  programSignature,
  restorablePosition,
  type WorkoutPosition,
} from "../workoutPosition";

const rows = [
  { ex: "Squat", sets: "3" },
  { ex: "Bench", sets: "3" },
];
const pos: WorkoutPosition = {
  v: 1,
  date: "2026-10-18",
  sessionId: "s1",
  signature: programSignature(rows),
  isPaused: false,
  isFinished: false,
  mode: "rest",
  exerciseIndex: 1,
  currentSet: 2,
  restTotalSeconds: 120,
  timing: {
    sessionStartedAt: 1000,
    pausedAccumMs: 0,
    pauseStartedAt: null,
    restEndsAt: 5000,
    pausedRestRemainingMs: null,
    finishedAt: null,
  },
  pendingNext: { exerciseIndex: 1, currentSet: 3 },
  completedExercises: [0],
  setsThisSession: {
    Squat: [
      { weightKg: 100, reps: 5 },
      { weightKg: 100, reps: 5 },
      { weightKg: 100, reps: 5 },
    ],
    Bench: [{ weightKg: 60, reps: 8 }],
  },
  prCount: 1,
  lastPrExercise: "Squat",
};

describe("restorablePosition", () => {
  it("restores a same-day position for the same program rows (JSON round trip)", () => {
    const raw = JSON.parse(JSON.stringify(pos));
    expect(restorablePosition(raw, "2026-10-18", rows)).toEqual(pos);
  });

  it("drops a position from another day, another program or a malformed one", () => {
    expect(restorablePosition(pos, "2026-10-19", rows)).toBeNull();
    expect(restorablePosition(pos, "2026-10-18", rows.slice(0, 1))).toBeNull();
    expect(restorablePosition(pos, "2026-10-18", [])).toBeNull();
    expect(
      restorablePosition(Object.assign({}, pos, { exerciseIndex: 5 }), "2026-10-18", rows)
    ).toBeNull();
    expect(
      restorablePosition(Object.assign({}, pos, { mode: "x" }), "2026-10-18", rows)
    ).toBeNull();
    expect(
      restorablePosition(
        Object.assign({}, pos, {
          timing: Object.assign({}, pos.timing, { sessionStartedAt: null }),
        }),
        "2026-10-18",
        rows
      )
    ).toBeNull();
    expect(restorablePosition(null, "2026-10-18", rows)).toBeNull();
    expect(restorablePosition("x", "2026-10-18", rows)).toBeNull();
  });
});
