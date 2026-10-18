import { api, type ApiResponse } from "./client";
import { qk } from "../sync/queryKeys";
import { syncContextReady } from "../sync/runtime";

export interface WorkoutSession {
  id: string;
  date: string;
  programDayName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
}

export interface LoggedSet {
  id: string;
  sessionId: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rir: string | null;
}

export interface ExerciseHistoryEntry {
  sessionId: string;
  date: string;
  sets: Array<{
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
    rir: string | null;
  }>;
}

export type ExerciseHistory = Record<string, ExerciseHistoryEntry>;

export async function startWorkoutSession(date: string, programDayName?: string) {
  return api.post<WorkoutSession>("/workouts/sessions", { date, programDayName });
}

export async function logWorkoutSet(
  sessionId: string,
  set: {
    exerciseName: string;
    setNumber: number;
    weightKg?: number | null;
    reps?: number | null;
    rir?: string | null;
  }
) {
  return api.post<LoggedSet>(`/workouts/sessions/${sessionId}/sets`, set);
}

export async function deleteWorkoutSet(setId: string) {
  return api.delete<null>(`/workouts/sets/${setId}`);
}

export async function finishWorkoutSession(sessionId: string, durationSeconds: number) {
  return api.patch<WorkoutSession>(`/workouts/sessions/${sessionId}/finish`, {
    durationSeconds,
  });
}

export type WorkoutSessionWithSets = WorkoutSession & { sets: LoggedSet[] };

/** Recent sessions with sets; the last good copy when offline (prefill/PRs). */
const HISTORY_FRESH_MS = 30 * 60 * 1000;

// Concurrent callers (recap card, workout start) share one request.
const inFlight = new Map<number, Promise<ApiResponse<WorkoutSessionWithSets[]>>>();

export function getWorkoutSessions(
  limit = 30
): Promise<ApiResponse<WorkoutSessionWithSets[]>> {
  const running = inFlight.get(limit);
  if (running) return running;
  const p = loadWorkoutSessions(limit).finally(() => inFlight.delete(limit));
  inFlight.set(limit, p);
  return p;
}

async function loadWorkoutSessions(
  limit: number
): Promise<ApiResponse<WorkoutSessionWithSets[]>> {
  const ctx = await syncContextReady();
  if (ctx) {
    // Recent enough, not invalidated by a workout write, and fetched with at
    // least this limit: no request (keeps the Monday recap off the startup path).
    const state = ctx.qc.getQueryState<WorkoutSessionWithSets[]>(
      qk.workoutHistory(ctx.userId)
    );
    if (
      state &&
      state.data &&
      !state.isInvalidated &&
      (ctx.qc.getQueryData<number>(qk.workoutHistory(ctx.userId).concat(["limit"])) ??
        0) >= limit &&
      Date.now() - state.dataUpdatedAt < HISTORY_FRESH_MS
    )
      return { success: true, data: state.data.slice(0, limit) };
  }
  const res = await api.get<WorkoutSessionWithSets[]>(
    `/workouts/sessions?limit=${limit}`
  );
  if (!ctx) return res;
  const key = qk.workoutHistory(ctx.userId);
  if (res.success && res.data) {
    ctx.qc.setQueryData(key.concat(["limit"]), limit);
    ctx.qc.setQueryData(key, res.data);
    return res;
  }
  const cached = ctx.qc.getQueryData<WorkoutSessionWithSets[]>(key);
  if (res.networkError && cached) return { success: true, data: cached.slice(0, limit) };
  return res;
}

export interface ExerciseSession {
  sessionId: string;
  date: string;
  sets: Array<{
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
    rir: string | null;
  }>;
}

export async function getExerciseSessions(name: string, limit = 30) {
  return api.get<ExerciseSession[]>(
    `/workouts/exercise-sessions?name=${encodeURIComponent(name)}&limit=${limit}`
  );
}

export async function getExerciseHistory(
  exerciseNames: string[],
  excludeSessionId?: string
) {
  const names = encodeURIComponent(exerciseNames.join("|"));
  const exclude = excludeSessionId
    ? `&excludeSessionId=${encodeURIComponent(excludeSessionId)}`
    : "";
  return api.get<ExerciseHistory>(`/workouts/exercise-history?names=${names}${exclude}`);
}
