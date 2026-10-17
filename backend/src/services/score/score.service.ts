// Server-computed DailyScore (Bet 5). Rows are recomputed from source data
// whenever something relevant for a date changes, and lazily on read for rows
// written by the legacy client (computedAt = null). The client's POST /scores
// payload is never stored.
import { Prisma, type DailyScore } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { addDays, localDateKey, weekdayName } from '../../utils/dates.js';
import {
  bodyweightSlope,
  leadingNumber,
  resolvePlan,
  scoreDay,
  sumMacros,
  templateMacros,
  type DayFacts,
  type Macros,
  type PlanDay,
} from './dayFacts.js';
import { computeStreak, type StreakResult } from './streak.js';

const BW_LOOKBACK_DAYS = 365;

export interface ScoreTargets {
  proteinTarget: number | null;
  calorieTarget: number | null;
  goalRate: number | null;
}

export function targetsFromPrefs(
  prefs: {
    proteinTargetG: number | null;
    calorieTargetKcal: number | null;
    goalRateKgPerWeek: number | null;
    proteinTarget: string;
  } | null
): ScoreTargets {
  if (!prefs) return { proteinTarget: null, calorieTarget: null, goalRate: null };
  return {
    // Numeric target wins; otherwise the lower bound of the legacy free-text
    // target ("140-150 g/day" → 140).
    proteinTarget: prefs.proteinTargetG ?? leadingNumber(prefs.proteinTarget),
    calorieTarget: prefs.calorieTargetKcal,
    goalRate: prefs.goalRateKgPerWeek,
  };
}

export async function loadProgramDays(
  userId: string,
  programId: string | null | undefined
): Promise<PlanDay[] | null> {
  if (!programId) return null;
  const program = await prisma.gymProgram.findFirst({
    where: { id: programId, OR: [{ isSystem: true }, { userId }] },
    select: {
      days: {
        orderBy: { dayOrder: 'asc' },
        select: {
          id: true,
          name: true,
          weekdays: true,
          exercises: { select: { sets: true } },
        },
      },
    },
  });
  return program ? program.days : null;
}

function inc(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export class ScoreService {
  /** User's "today" in their timezone. */
  async todayFor(userId: string): Promise<string> {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return localDateKey(prefs?.timezone);
  }

  /**
   * Recompute and store DailyScore for every date in [from, to] that has data
   * or an existing row. Loads everything for the range in one batch of queries.
   */
  async recomputeRange(
    userId: string,
    from: string,
    to: string,
    opts: { includeEmpty?: boolean } = {}
  ): Promise<void> {
    if (from > to) return;
    const range = { gte: from, lte: to };
    const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
    const [
      programDays,
      blocksTotal,
      suppTotal,
      templates,
      completions,
      suppLogs,
      mealLogs,
      sessions,
      dayLogs,
      weighIns,
      existing,
    ] = await Promise.all([
      loadProgramDays(userId, prefs?.selectedProgramId),
      prisma.scheduleBlock.count({ where: { userId } }),
      prisma.supplement.count({ where: { userId } }),
      prisma.mealTemplate.findMany({
        where: { userId },
        select: {
          id: true,
          dayOfWeek: true,
          grams: true,
          tags: { select: { label: true, value: true } },
        },
      }),
      prisma.completion.groupBy({
        by: ['date'],
        where: { userId, date: range, isComplete: true },
        _count: { _all: true },
      }),
      prisma.supplementLog.groupBy({
        by: ['date'],
        where: { userId, date: range, isTaken: true },
        _count: { _all: true },
      }),
      prisma.mealLog.findMany({
        where: { userId, date: range, isEaten: true },
        select: { date: true, mealTemplateId: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId, date: range },
        select: {
          date: true,
          programDayName: true,
          endedAt: true,
          _count: { select: { sets: true } },
        },
      }),
      prisma.dailyLog.findMany({
        where: { userId, date: range },
        select: { date: true, day: true },
      }),
      prisma.dailyLog.findMany({
        where: {
          userId,
          date: { gte: addDays(from, -BW_LOOKBACK_DAYS), lte: to },
          bw: { not: null },
        },
        select: { date: true, bw: true },
      }),
      prisma.dailyScore.findMany({
        where: { userId, date: range },
        select: { date: true },
      }),
    ]);

    const targets = targetsFromPrefs(prefs);
    const tplById = new Map(
      templates.map((t) => [
        t.id,
        {
          dayOfWeek: t.dayOfWeek,
          macros: templateMacros({
            id: t.id,
            grams: t.grams === null ? null : Number(t.grams),
            tags: t.tags,
          }),
        },
      ])
    );
    const mealsTotalByWeekday = new Map<string, number>();
    for (const t of templates) inc(mealsTotalByWeekday, t.dayOfWeek);

    const tasksDone = new Map(completions.map((c) => [c.date, c._count._all]));
    const suppDone = new Map(suppLogs.map((c) => [c.date, c._count._all]));
    const eatenByDate = new Map<string, string[]>();
    for (const m of mealLogs) {
      const list = eatenByDate.get(m.date) ?? [];
      list.push(m.mealTemplateId);
      eatenByDate.set(m.date, list);
    }
    const sessionsByDate = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const list = sessionsByDate.get(s.date) ?? [];
      list.push(s);
      sessionsByDate.set(s.date, list);
    }
    const dayLogByDate = new Map(dayLogs.map((l) => [l.date, l.day]));
    const weights = weighIns
      .map((w) => ({ date: w.date, kg: leadingNumber(w.bw) ?? NaN }))
      .filter((w) => Number.isFinite(w.kg));
    const hasRow = new Set(existing.map((e) => e.date));

    const writes: Prisma.PrismaPromise<DailyScore>[] = [];
    const now = new Date();
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const eaten = eatenByDate.get(date) ?? [];
      const daySessions = sessionsByDate.get(date) ?? [];
      const hasData =
        tasksDone.has(date) ||
        suppDone.has(date) ||
        eaten.length > 0 ||
        daySessions.length > 0 ||
        dayLogByDate.has(date);
      if (!hasData && !hasRow.has(date) && !opts.includeEmpty) continue;

      const weekday = weekdayName(date);
      const eatenTemplates = eaten
        .map((id) => tplById.get(id))
        .filter((t): t is NonNullable<typeof t> => !!t);
      const macros: Macros | null =
        eatenTemplates.length > 0 ? sumMacros(eatenTemplates.map((t) => t.macros)) : null;
      const facts: DayFacts = {
        tasksDone: tasksDone.get(date) ?? 0,
        tasksTotal: blocksTotal,
        suppDone: suppDone.get(date) ?? 0,
        suppTotal,
        mealsDone: eatenTemplates.filter((t) => t.dayOfWeek === weekday).length,
        mealsTotal: mealsTotalByWeekday.get(weekday) ?? 0,
        macros,
        setsDone: daySessions.reduce((n, s) => n + s._count.sets, 0),
        sessionCount: daySessions.length,
        finishedSession: daySessions.some((s) => s.endedAt !== null),
        plan: resolvePlan(
          date,
          programDays,
          daySessions.map((s) => s.programDayName),
          dayLogByDate.get(date) ?? null
        ),
        bwSlope: bodyweightSlope(weights, date),
        proteinTarget: targets.proteinTarget,
        calorieTarget: targets.calorieTarget,
        goalRate: targets.goalRate,
      };
      const p = scoreDay(facts);
      const data = {
        score: p.score,
        tasksDone: p.tasksDone,
        tasksTotal: p.tasksTotal,
        suppDone: p.suppDone,
        suppTotal: p.suppTotal,
        mealsDone: p.mealsDone,
        mealsTotal: p.mealsTotal,
        workoutDone: p.workoutDone,
        protein: p.protein,
        calories: p.calories,
        outcomeScore: p.outcomeScore,
        kept: p.kept,
        routinePct: p.routinePct,
        components: p.components as unknown as Prisma.InputJsonValue,
        plan: p.plan,
        setsDone: p.setsDone,
        setsPlanned: p.setsPlanned,
        computedAt: now,
      };
      writes.push(
        prisma.dailyScore.upsert({
          where: { userId_date: { userId, date } },
          create: Object.assign({ userId, date }, data),
          update: data,
        })
      );
    }
    if (writes.length > 0) await prisma.$transaction(writes);
  }

  /**
   * Recompute after a write touching `date`. Bodyweight changes also move the
   * trend of the following two weeks, so `cascadeDays` extends the range
   * (capped at the user's today). Failures are logged, never thrown: the write
   * itself already committed and the next read recomputes.
   */
  async afterWrite(userId: string, date: string, cascadeDays = 0): Promise<void> {
    try {
      let to = date;
      if (cascadeDays > 0) {
        const today = await this.todayFor(userId);
        const capped = addDays(date, cascadeDays);
        to = capped < today ? capped : today > date ? today : date;
      }
      await this.recomputeRange(userId, date, to);
    } catch (error) {
      console.error('score recompute failed', error);
    }
  }

  /** Recompute "today" after a change that affects every day (targets, plan, catalog). */
  async afterCatalogChange(userId: string): Promise<void> {
    await this.afterWrite(userId, await this.todayFor(userId));
  }

  /** Rows in [from, to]; legacy rows (never server-computed) are recomputed first. */
  async getRange(userId: string, from: string, to: string): Promise<DailyScore[]> {
    const stale = await prisma.dailyScore.count({
      where: { userId, date: { gte: from, lte: to }, computedAt: null },
    });
    if (stale > 0) await this.recomputeRange(userId, from, to);
    else await this.recomputeRange(userId, to, to);
    return prisma.dailyScore.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
  }

  async streak(userId: string, today: string): Promise<StreakResult> {
    const rows = await prisma.dailyScore.findMany({
      where: { userId, date: { lte: today } },
      select: { date: true, kept: true, outcomeScore: true },
      orderBy: { date: 'desc' },
      take: 3700,
    });
    return computeStreak(
      rows.map((r) => ({ date: r.date, kept: r.kept, scored: r.outcomeScore !== null })),
      today
    );
  }
}

export const scoreService = new ScoreService();

/** Public shape of one day's score for /today and GET /scores?v=2. */
export function presentScore(row: DailyScore | null | undefined) {
  if (!row) return null;
  return {
    date: row.date,
    outcomeScore: row.outcomeScore,
    kept: row.kept,
    scored: row.outcomeScore !== null,
    components: row.components,
    routinePct: row.routinePct,
    plan: row.plan,
    setsDone: row.setsDone,
    setsPlanned: row.setsPlanned,
    protein: row.protein,
    calories: row.calories,
    workoutDone: row.workoutDone,
    tasksDone: row.tasksDone,
    tasksTotal: row.tasksTotal,
    suppDone: row.suppDone,
    suppTotal: row.suppTotal,
    mealsDone: row.mealsDone,
    mealsTotal: row.mealsTotal,
    computedAt: row.computedAt,
  };
}
