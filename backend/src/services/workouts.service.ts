import { prisma } from '../config/database.js';
import type { StartSessionInput, LogSetInput, FinishSessionInput } from '../validators/workouts.schema.js';

export class WorkoutsService {
  async startSession(userId: string, data: StartSessionInput) {
    return prisma.workoutSession.create({
      data: {
        userId,
        date: data.date,
        programDayName: data.programDayName,
      },
    });
  }

  async logSet(userId: string, sessionId: string, data: LogSetInput) {
    // Ensure the session belongs to the user
    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) return null;

    return prisma.workoutSetLog.create({
      data: {
        userId,
        sessionId,
        exerciseName: data.exerciseName,
        setNumber: data.setNumber,
        weightKg: data.weightKg ?? null,
        reps: data.reps ?? null,
        rir: data.rir ?? null,
      },
    });
  }

  async finishSession(userId: string, sessionId: string, data: FinishSessionInput) {
    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) return null;

    return prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        durationSeconds: data.durationSeconds,
      },
    });
  }

  async getSessions(userId: string, limit = 30, offset = 0) {
    return prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        sets: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  /**
   * For each exercise name, return the sets from the most recent *finished*
   * session (excluding the given session id, so an in-progress workout never
   * compares against itself).
   */
  async getExerciseHistory(userId: string, exerciseNames: string[], excludeSessionId?: string) {
    if (exerciseNames.length === 0) return {};

    const logs = await prisma.workoutSetLog.findMany({
      where: {
        userId,
        exerciseName: { in: exerciseNames },
        ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        session: { select: { id: true, date: true } },
      },
    });

    const history: Record<
      string,
      { sessionId: string; date: string; sets: Array<{ setNumber: number; weightKg: number | null; reps: number | null; rir: string | null }> }
    > = {};

    for (const log of logs) {
      const existing = history[log.exerciseName];
      // First log seen for an exercise is from its latest session; only keep
      // logs from that same session.
      if (!existing) {
        history[log.exerciseName] = {
          sessionId: log.session.id,
          date: log.session.date,
          sets: [
            {
              setNumber: log.setNumber,
              weightKg: log.weightKg ? Number(log.weightKg) : null,
              reps: log.reps,
              rir: log.rir,
            },
          ],
        };
      } else if (existing.sessionId === log.session.id) {
        existing.sets.push({
          setNumber: log.setNumber,
          weightKg: log.weightKg ? Number(log.weightKg) : null,
          reps: log.reps,
          rir: log.rir,
        });
      }
    }

    for (const name of Object.keys(history)) {
      history[name].sets.sort((a, b) => a.setNumber - b.setNumber);
    }

    return history;
  }
}

export const workoutsService = new WorkoutsService();
