import { api } from "./client";

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  primaryMuscle: string | null;
  equipment: string | null;
}

export async function searchExercises(query: string, limit = 12) {
  return api.get<ExerciseLibraryItem[]>(
    `/exercises?search=${encodeURIComponent(query)}&limit=${limit}`
  );
}
