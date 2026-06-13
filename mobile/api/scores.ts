import { api } from "./client";

export interface DailyScore {
  date: string;
  score: number;
  tasksDone: number;
  tasksTotal: number;
  suppDone: number;
  suppTotal: number;
  mealsDone: number;
  mealsTotal: number;
  workoutDone: boolean;
}

export interface ScoreSnapshot {
  date: string;
  score: number;
  tasksDone?: number;
  tasksTotal?: number;
  suppDone?: number;
  suppTotal?: number;
  mealsDone?: number;
  mealsTotal?: number;
  workoutDone?: boolean;
}

export async function getScores(days = 30) {
  return api.get<DailyScore[]>(`/scores?days=${days}`);
}

export async function postScore(snapshot: ScoreSnapshot) {
  return api.post<DailyScore>("/scores", snapshot);
}
