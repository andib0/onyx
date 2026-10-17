// Timestamp-based workout clock. The hook stores only timestamps (they change
// on events: start, pause, rest start…); ticking displays derive seconds from
// "now" locally, so the 500 ms tick doesn't re-render the whole tree
// (audit 07: 26 renders/s during a workout).

export type WorkoutTiming = {
  sessionStartedAt: number | null;
  pausedAccumMs: number;
  pauseStartedAt: number | null;
  restEndsAt: number | null;
  pausedRestRemainingMs: number | null;
  finishedAt: number | null;
};

export const EMPTY_TIMING: WorkoutTiming = {
  sessionStartedAt: null,
  pausedAccumMs: 0,
  pauseStartedAt: null,
  restEndsAt: null,
  pausedRestRemainingMs: null,
  finishedAt: null,
};

export function sessionSecondsAt(t: WorkoutTiming, now: number): number {
  if (!t.sessionStartedAt) return 0;
  const end = t.finishedAt ?? now;
  const pausedMs = t.pausedAccumMs + (t.pauseStartedAt ? end - t.pauseStartedAt : 0);
  return Math.max(Math.floor((end - t.sessionStartedAt - pausedMs) / 1000), 0);
}

export function restSecondsRemainingAt(t: WorkoutTiming, now: number): number {
  if (t.pausedRestRemainingMs !== null) {
    return Math.max(Math.ceil(t.pausedRestRemainingMs / 1000), 0);
  }
  if (t.restEndsAt === null) return 0;
  return Math.max(Math.ceil((t.restEndsAt - now) / 1000), 0);
}

// A finished workout counts as done when ≥ 80 % of planned sets were logged —
// the same threshold as the Outcome Score's T component (contracts/README.md).
export function workoutCountsAsDone(setsLogged: number, setsPlanned: number): boolean {
  if (!(setsPlanned > 0)) return setsLogged > 0;
  return setsLogged >= 0.8 * setsPlanned - 1e-9;
}
