import { prisma } from '../config/database.js';

export interface ScoreInput {
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

export class ScoresService {
  // Upsert one day's score snapshot. Today's row updates as the day progresses;
  // past rows freeze once the day rolls over (client stops sending them).
  async upsertScore(userId: string, data: ScoreInput) {
    const payload = {
      score: Math.max(0, Math.min(100, Math.round(data.score))),
      tasksDone: data.tasksDone ?? 0,
      tasksTotal: data.tasksTotal ?? 0,
      suppDone: data.suppDone ?? 0,
      suppTotal: data.suppTotal ?? 0,
      mealsDone: data.mealsDone ?? 0,
      mealsTotal: data.mealsTotal ?? 0,
      workoutDone: data.workoutDone ?? false,
    };
    return prisma.dailyScore.upsert({
      where: { userId_date: { userId, date: data.date } },
      create: { userId, date: data.date, ...payload },
      update: payload,
    });
  }

  async getScores(userId: string, days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().split('T')[0];
    return prisma.dailyScore.findMany({
      where: { userId, date: { gte: startStr } },
      orderBy: { date: 'asc' },
    });
  }
}

export const scoresService = new ScoresService();
