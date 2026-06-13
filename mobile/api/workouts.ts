import { api } from "./client";

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

export async function getWorkoutSessions(limit = 30) {
  return api.get<WorkoutSessionWithSets[]>(`/workouts/sessions?limit=${limit}`);
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
