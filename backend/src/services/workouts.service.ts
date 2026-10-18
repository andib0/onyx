import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { hlcWins } from '../utils/hlc.js';
import { createIdempotent } from '../utils/idempotent.js';
import { scoreService } from './score/score.service.js';
import {
  assertNotTombstoned,
  deleteStamp,
  goneError,
  isTombstoned,
  recordTombstones,
} from './sync/tombstones.js';
import type {
  StartSessionInput,
  LogSetInput,
  FinishSessionInput,
} from '../validators/workouts.schema.js';

export class WorkoutsService {
  /** Idempotent when the client sends its own `id` (a retried start returns the same
   *  session); 410 when that session was deleted. */
  async startSession(userId: string, data: StartSessionInput) {
    await assertNotTombstoned(userId, 'session', data.id);
    const result = await createIdempotent(
      userId,
      data.id,
      (id) => prisma.workoutSession.findUnique({ where: { id } }),
      () =>
        prisma.workoutSession.create({
          data: {
            id: data.id,
            userId,
            date: data.date,
            programDayName: data.programDayName,
            startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
          },
        })
    );
    if (result.created) await scoreService.afterWrite(userId, data.date);
    return result;
  }

  /**
   * One row per (session, exercise, set number): a repeated POST updates that
   * set instead of inserting a duplicate (docs/audit/02 §2.1). With an `hlc`,
   * the values are replaced only by a newer stamp. A client `id` is used for a
   * new row; posting an existing id updates that row. Returns null if the
   * session is missing or not the user's; 410 if the session or the set id
   * was deleted (an undone set is never resurrected by a delayed retry).
   */
  async logSet(userId: string, sessionId: string, data: LogSetInput) {
    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, date: true },
    });
    if (!session) {
      if (await isTombstoned(userId, 'session', sessionId)) throw goneError();
      return null;
    }
    await assertNotTombstoned(userId, 'set', data.id);

    const values = {
      weightKg: data.weightKg ?? null,
      reps: data.reps ?? null,
      rir: data.rir ?? null,
    };

    if (data.id) {
      const byId = await prisma.workoutSetLog.findUnique({ where: { id: data.id } });
      if (byId) {
        if (byId.userId !== userId || byId.sessionId !== sessionId) {
          throw new AppError('id already in use', 409, 'ID_CONFLICT');
        }
        if (data.hlc && !hlcWins(data.hlc, byId.hlc))
          return { row: byId, created: false };
        const row = await prisma.workoutSetLog.update({
          where: { id: byId.id },
          data: Object.assign(
            {
              exerciseName: data.exerciseName,
              setNumber: data.setNumber,
              hlc: data.hlc ?? byId.hlc,
            },
            values
          ),
        });
        await scoreService.afterWrite(userId, session.date);
        return { row, created: false };
      }
    }

    const rows = await prisma.$queryRaw<Array<{ id: string; inserted: boolean }>>`
      INSERT INTO "WorkoutSetLog"
        ("id", "userId", "sessionId", "exerciseName", "setNumber", "weightKg", "reps", "rir", "hlc", "createdAt")
      VALUES (${data.id ?? randomUUID()}, ${userId}, ${sessionId}, ${data.exerciseName},
              ${data.setNumber}, ${values.weightKg}::numeric, ${values.reps}::int, ${values.rir},
              ${data.hlc ?? null}, (now() AT TIME ZONE 'UTC'))
      ON CONFLICT ("sessionId", "exerciseName", "setNumber") DO UPDATE
        SET "weightKg" = EXCLUDED."weightKg",
            "reps" = EXCLUDED."reps",
            "rir" = EXCLUDED."rir",
            "hlc" = COALESCE(EXCLUDED."hlc", "WorkoutSetLog"."hlc")
        WHERE EXCLUDED."hlc" IS NULL
           OR "WorkoutSetLog"."hlc" IS NULL
           OR "WorkoutSetLog"."hlc" COLLATE "C" < EXCLUDED."hlc" COLLATE "C"
      RETURNING "id", (xmax = 0) AS "inserted"`;
    if (rows.length > 0) await scoreService.afterWrite(userId, session.date);
    const row =
      rows.length > 0
        ? await prisma.workoutSetLog.findUniqueOrThrow({ where: { id: rows[0].id } })
        : await prisma.workoutSetLog.findUniqueOrThrow({
            where: {
              sessionId_exerciseName_setNumber: {
                sessionId,
                exerciseName: data.exerciseName,
                setNumber: data.setNumber,
              },
            },
          });
    return { row, created: rows.length > 0 && rows[0].inserted };
  }

  /** Idempotent: a repeated finish keeps the first endedAt unless a new one is sent.
   *  `markedDone` is sticky (a later plain finish does not clear it). */
  async finishSession(userId: string, sessionId: string, data: FinishSessionInput) {
    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, date: true, endedAt: true },
    });
    if (!session) {
      if (await isTombstoned(userId, 'session', sessionId)) throw goneError();
      return null;
    }

    const updated = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        endedAt: data.endedAt ? new Date(data.endedAt) : (session.endedAt ?? new Date()),
        durationSeconds: data.durationSeconds,
        markedDone: data.markedDone ? true : undefined,
      },
    });
    await scoreService.afterWrite(userId, session.date);
    return updated;
  }

  /** Deletes the set and tombstones its id. */
  async deleteSet(userId: string, setId: string, hlc?: string) {
    const set = await prisma.workoutSetLog.findFirst({
      where: { id: setId, userId },
      select: { session: { select: { date: true } } },
    });
    const count = await prisma.$transaction(async (tx) => {
      const result = await tx.workoutSetLog.deleteMany({ where: { id: setId, userId } });
      if (result.count > 0)
        await recordTombstones(
          tx,
          userId,
          [{ entity: 'set', entityId: setId }],
          deleteStamp(hlc)
        );
      return result.count;
    });
    if (set) await scoreService.afterWrite(userId, set.session.date);
    return count > 0;
  }

  /** Deletes a session with its sets and tombstones all of their ids. */
  async deleteSession(userId: string, sessionId: string, hlc?: string) {
    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { date: true, sets: { select: { id: true } } },
    });
    if (!session) return false;
    await prisma.$transaction(async (tx) => {
      await tx.workoutSession.delete({ where: { id: sessionId } });
      await recordTombstones(
        tx,
        userId,
        [
          { entity: 'session', entityId: sessionId },
          ...session.sets.map((s) => ({ entity: 'set' as const, entityId: s.id })),
        ],
        deleteStamp(hlc)
      );
    });
    await scoreService.afterWrite(userId, session.date);
    return true;
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
   * All logged sessions for one exercise (newest first), grouped by session,
   * for the exercise detail screen's history list and charts.
   */
  async getExerciseSessions(userId: string, exerciseName: string, limit = 30) {
    const logs = await prisma.workoutSetLog.findMany({
      where: { userId, exerciseName },
      orderBy: { createdAt: 'asc' },
      include: { session: { select: { id: true, date: true } } },
    });

    const bySession = new Map<
      string,
      {
        sessionId: string;
        date: string;
        sets: Array<{
          setNumber: number;
          weightKg: number | null;
          reps: number | null;
          rir: string | null;
        }>;
      }
    >();

    for (const log of logs) {
      let entry = bySession.get(log.session.id);
      if (!entry) {
        entry = { sessionId: log.session.id, date: log.session.date, sets: [] };
        bySession.set(log.session.id, entry);
      }
      entry.sets.push({
        setNumber: log.setNumber,
        weightKg: log.weightKg ? Number(log.weightKg) : null,
        reps: log.reps,
        rir: log.rir,
      });
    }

    return Array.from(bySession.values())
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit)
      .map((entry) => ({
        sessionId: entry.sessionId,
        date: entry.date,
        sets: entry.sets.sort((a, b) => a.setNumber - b.setNumber),
      }));
  }

  /**
   * For each exercise name, return the sets from the most recent *finished*
   * session (excluding the given session id, so an in-progress workout never
   * compares against itself).
   */
  async getExerciseHistory(
    userId: string,
    exerciseNames: string[],
    excludeSessionId?: string
  ) {
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
      {
        sessionId: string;
        date: string;
        sets: Array<{
          setNumber: number;
          weightKg: number | null;
          reps: number | null;
          rir: string | null;
        }>;
      }
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
