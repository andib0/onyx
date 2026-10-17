import { api } from "./client";
import { triggerScore } from "../sync/writes";

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
  protein: number;
  calories: number;
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
  protein?: number;
  calories?: number;
}

export async function getScores(days = 30) {
  return api.get<DailyScore[]>(`/scores?days=${days}`);
}

/** Asks the server to recompute a day (it ignores client values); queued in
 *  the outbox and skipped when nothing changed since the last trigger. */
export async function postScore(snapshot: ScoreSnapshot) {
  return triggerScore(snapshot as ScoreSnapshot & Record<string, unknown>);
}
