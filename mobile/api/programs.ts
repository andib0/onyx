import { api } from "./client";

export type ProgramDaySummary = {
  id: string;
  name: string;
  dayOrder: number;
};

export type ProgramSummary = {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  isSystem: boolean;
  userId: string | null;
  days: ProgramDaySummary[];
};

export type ProgramExercise = {
  id: string;
  exerciseName: string;
  sets: string;
  reps: string;
  rir: string | null;
  restSeconds: string | null;
  notes: string | null;
  progression: string | null;
  sortOrder: number;
};

export type ProgramDay = {
  id: string;
  name: string;
  dayOrder: number;
  exercises: ProgramExercise[];
};

export type ProgramDetail = {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  isSystem: boolean;
  userId: string | null;
  days: ProgramDay[];
};

export type ProgramExerciseInput = {
  exerciseName: string;
  sets: string;
  reps: string;
  rir?: string | null;
  restSeconds?: string | null;
  notes?: string | null;
  progression?: string | null;
};

export type ProgramDayInput = {
  name: string;
  exercises: ProgramExerciseInput[];
};

export type ProgramInput = {
  name: string;
  description?: string | null;
  goal: string;
  days: ProgramDayInput[];
};

export async function listPrograms() {
  return api.get<ProgramSummary[]>("/programs");
}

export async function getProgram(id: string) {
  return api.get<ProgramDetail>(`/programs/${id}`);
}

export async function createProgram(input: ProgramInput) {
  return api.post<ProgramDetail>("/programs", input);
}

export async function updateProgram(id: string, input: ProgramInput) {
  return api.put<ProgramDetail>(`/programs/${id}`, input);
}

export async function deleteProgram(id: string) {
  return api.delete<null>(`/programs/${id}`);
}
