import { prisma } from '../config/database.js';
import { addDays } from '../utils/dates.js';
import { presentScore, scoreService } from './score/score.service.js';

export class ScoresService {
  /**
   * Legacy POST /scores. The day's score is computed by the server from the
   * underlying data (Bet 5); the client payload is ignored, so a stale device
   * can no longer overwrite it with zeros (docs/audit/02 §2.6). The request
   * still triggers a recompute and returns the server row.
   */
  async upsertScore(userId: string, date: string) {
    await scoreService.recomputeRange(userId, date, date);
    const row = await prisma.dailyScore.findUnique({
      where: { userId_date: { userId, date } },
    });
    return row ?? { date, score: 0, outcomeScore: null, kept: false };
  }

  /** Last `days` days ending today (user timezone), oldest first. */
  async getScores(userId: string, days = 30) {
    const today = await scoreService.todayFor(userId);
    const from = addDays(today, -(days - 1));
    return { today, rows: await scoreService.getRange(userId, from, today) };
  }

  /** GET /scores?v=2: history plus today's score and the streak. */
  async getScoresV2(userId: string, days = 30) {
    const { today, rows } = await this.getScores(userId, days);
    const streak = await scoreService.streak(userId, today);
    return {
      today,
      todayScore: presentScore(rows.find((r) => r.date === today)),
      streak,
      days: rows.map(presentScore),
    };
  }
}

export const scoresService = new ScoresService();
