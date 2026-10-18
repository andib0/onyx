// In-progress workout position (exercise / set / rest state / timers), saved
// with the outbox (sync/runtime.ts saveWorkoutPosition → outbox aux) so an app
// kill mid-workout reopens on the same set. Pure: build, validate, restore.

import type { ProgramRow } from "../types/appTypes";
import type { WorkoutTiming } from "./workoutClock";

export type LoggedSet = {
  weightKg: number | null;
  reps: number | null;
  rir?: number | null;
};

export type WorkoutPosition = {
  v: 1;
  /** local date the session started; a position from another day is dropped */
  date: string;
  sessionId: string;
  /** program rows the indices refer to (see programSignature) */
  signature: string;
  isPaused: boolean;
  isFinished: boolean;
  mode: "lifting" | "rest";
  exerciseIndex: number;
  currentSet: number;
  restTotalSeconds: number;
  timing: WorkoutTiming;
  pendingNext: { exerciseIndex: number; currentSet: number } | null;
  completedExercises: number[];
  setsThisSession: Record<string, LoggedSet[]>;
  prCount: number;
  lastPrExercise: string | null;
};

/** Identity of the planned rows (indices are only meaningful for the same list). */
export function programSignature(rows: Array<Pick<ProgramRow, "ex" | "sets">>): string {
  return rows.map((r) => `${r.ex}|${r.sets}`).join(";");
}

const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);
const numOrNull = (v: unknown) => v === null || isNum(v);

function validTiming(t: unknown): t is WorkoutTiming {
  if (!t || typeof t !== "object") return false;
  const o = t as Record<string, unknown>;
  return (
    numOrNull(o.sessionStartedAt) &&
    isNum(o.pausedAccumMs) &&
    numOrNull(o.pauseStartedAt) &&
    numOrNull(o.restEndsAt) &&
    numOrNull(o.pausedRestRemainingMs) &&
    numOrNull(o.finishedAt)
  );
}

/**
 * The saved position if it can be resumed now: same local day, same program
 * rows, indices in range, well-formed. Anything else → null (start fresh).
 */
export function restorablePosition(
  raw: unknown,
  today: string,
  rows: Array<Pick<ProgramRow, "ex" | "sets">>
): WorkoutPosition | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<WorkoutPosition>;
  if (p.v !== 1 || p.date !== today || typeof p.sessionId !== "string") return null;
  if (!rows.length || p.signature !== programSignature(rows)) return null;
  if (!isNum(p.exerciseIndex) || p.exerciseIndex < 0 || p.exerciseIndex >= rows.length)
    return null;
  if (!isNum(p.currentSet) || p.currentSet < 1) return null;
  if (p.mode !== "lifting" && p.mode !== "rest") return null;
  if (!validTiming(p.timing) || p.timing.sessionStartedAt === null) return null;
  if (!Array.isArray(p.completedExercises)) return null;
  if (!p.setsThisSession || typeof p.setsThisSession !== "object") return null;
  const next = p.pendingNext;
  if (
    next !== null &&
    (!next ||
      !isNum(next.exerciseIndex) ||
      next.exerciseIndex >= rows.length ||
      !isNum(next.currentSet))
  )
    return null;
  return {
    v: 1,
    date: p.date,
    sessionId: p.sessionId,
    signature: p.signature,
    isPaused: !!p.isPaused,
    isFinished: !!p.isFinished,
    mode: p.mode,
    exerciseIndex: p.exerciseIndex,
    currentSet: p.currentSet,
    restTotalSeconds: isNum(p.restTotalSeconds) ? p.restTotalSeconds : 90,
    timing: p.timing,
    pendingNext: next ?? null,
    completedExercises: p.completedExercises.filter(
      (i): i is number => isNum(i) && i >= 0 && i < rows.length
    ),
    setsThisSession: p.setsThisSession as Record<string, LoggedSet[]>,
    prCount: isNum(p.prCount) ? p.prCount : 0,
    lastPrExercise: typeof p.lastPrExercise === "string" ? p.lastPrExercise : null,
  };
}
