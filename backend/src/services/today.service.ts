// GET /api/today (Bet 1): everything the Focus screen needs for one date in a
// single request: today's score is recomputed, then all reads run in parallel.
import { prisma } from '../config/database.js';
import { addDays, isoWeekday, weekdayName } from '../utils/dates.js';
import { AppError } from '../utils/errors.js';
import { resolvePlan, sumMacros, templateMacros, type Macros } from './score/dayFacts.js';
import { computeStreak } from './score/streak.js';
import { presentScore, scoreService } from './score/score.service.js';

const SCORE_HISTORY_DAYS = 30;
const STREAK_LOOKBACK_DAYS = 3660;

const num = (v: { toString(): string } | null | undefined) =>
  v === null || v === undefined ? null : Number(v);

const round1 = (m: Macros): Macros => ({
  protein: Math.round(m.protein * 10) / 10,
  carbs: Math.round(m.carbs * 10) / 10,
  fat: Math.round(m.fat * 10) / 10,
  calories: Math.round(m.calories),
});

export async function getToday(userId: string, date: string) {
  const head = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: { select: { selectedProgramId: true } } },
  });
  if (!head) throw new AppError('Account not found', 401, 'ACCOUNT_NOT_FOUND');

  // Snapshot today's score from the current data before reading it back.
  await scoreService.recomputeRange(userId, date, date, { includeEmpty: true });

  const weekday = weekdayName(date);
  const programId = head.preferences?.selectedProgramId ?? null;
  // Independent reads run in parallel on the pool. A `$transaction([...])`
  // would give one snapshot but runs the 14 queries sequentially on one
  // connection (measured p50 27 ms vs 14 ms); a read racing a write only shows
  // that write one refetch later, which the client tolerates.
  const [
    user,
    blocks,
    completions,
    supplements,
    supplementLogs,
    templates,
    mealLogs,
    sessions,
    openSession,
    dailyLog,
    scores,
    streakRows,
    program,
    counts,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        age: true,
        weight: true,
        heightCm: true,
        sex: true,
        dataEpoch: true,
        createdAt: true,
        preferences: true,
      },
    }),
    prisma.scheduleBlock.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { start: 'asc' }],
    }),
    prisma.completion.findMany({ where: { userId, date } }),
    prisma.supplement.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { timeAt: 'asc' }],
    }),
    prisma.supplementLog.findMany({ where: { userId, date } }),
    prisma.mealTemplate.findMany({
      // This weekday's plan + one-off foods dated today (POST /meals/one-off)
      where: { userId, dayOfWeek: { in: [weekday, date] } },
      include: { tags: true },
      orderBy: [{ sortOrder: 'asc' }],
    }),
    prisma.mealLog.findMany({
      where: { userId, date },
      include: { mealTemplate: { include: { tags: true } } },
    }),
    prisma.workoutSession.findMany({
      where: { userId, date },
      orderBy: { startedAt: 'asc' },
      include: { sets: { orderBy: [{ exerciseName: 'asc' }, { setNumber: 'asc' }] } },
    }),
    // An unfinished session from yesterday (started late) still shows as open.
    prisma.workoutSession.findFirst({
      where: { userId, endedAt: null, date: { gte: addDays(date, -1), lte: date } },
      orderBy: { startedAt: 'desc' },
      include: { sets: { orderBy: [{ exerciseName: 'asc' }, { setNumber: 'asc' }] } },
    }),
    prisma.dailyLog.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.dailyScore.findMany({
      where: { userId, date: { gt: addDays(date, -SCORE_HISTORY_DAYS), lte: date } },
      orderBy: { date: 'asc' },
    }),
    prisma.dailyScore.findMany({
      where: { userId, date: { gte: addDays(date, -STREAK_LOOKBACK_DAYS), lte: date } },
      select: { date: true, kept: true, outcomeScore: true },
    }),
    prisma.gymProgram.findMany({
      where: { id: programId ?? '__none__', OR: [{ isSystem: true }, { userId }] },
      include: {
        days: {
          orderBy: { dayOrder: 'asc' },
          include: { exercises: { orderBy: { sortOrder: 'asc' } } },
        },
      },
      take: 1,
    }),
    prisma.$queryRaw<
      Array<{
        scheduleBlocks: number;
        supplements: number;
        mealTemplates: number;
        dailyLogs: number;
        workoutSessions: number;
        dailyScores: number;
      }>
    >`SELECT
        (SELECT count(*)::int FROM "ScheduleBlock" WHERE "userId" = ${userId}) AS "scheduleBlocks",
        (SELECT count(*)::int FROM "Supplement" WHERE "userId" = ${userId}) AS "supplements",
        (SELECT count(*)::int FROM "MealTemplate" WHERE "userId" = ${userId}) AS "mealTemplates",
        (SELECT count(*)::int FROM "DailyLog" WHERE "userId" = ${userId}) AS "dailyLogs",
        (SELECT count(*)::int FROM "WorkoutSession" WHERE "userId" = ${userId}) AS "workoutSessions",
        (SELECT count(*)::int FROM "DailyScore" WHERE "userId" = ${userId}) AS "dailyScores"`,
  ]);

  const prefs = user.preferences;
  const selected = program[0] ?? null;

  // Today's program day: fixed by weekday when the program has a calendar,
  // otherwise the day the user selected.
  const hasCalendar = !!selected?.days.some((d) => d.weekdays.length > 0);
  const todayDay = selected
    ? hasCalendar
      ? (selected.days.find((d) => d.weekdays.includes(isoWeekday(date))) ?? null)
      : (selected.days.find((d) => d.id === prefs?.selectedProgramDayId) ?? null)
    : null;
  const plan = resolvePlan(
    date,
    selected?.days ?? null,
    sessions.map((s) => s.programDayName),
    dailyLog?.day ?? null
  );

  const mealOut = templates.map((t) => {
    const grams = num(t.grams);
    return Object.assign({}, t, {
      grams,
      macros: round1(templateMacros({ id: t.id, grams, tags: t.tags })),
    });
  });
  const logsOut = mealLogs.map((l) => {
    const grams = num(l.mealTemplate.grams);
    const macros = templateMacros({
      id: l.mealTemplateId,
      grams,
      tags: l.mealTemplate.tags,
    });
    return {
      id: l.id,
      mealTemplateId: l.mealTemplateId,
      date: l.date,
      isEaten: l.isEaten,
      eatenAt: l.eatenAt,
      hlc: l.hlc,
      name: l.mealTemplate.name,
      dayOfWeek: l.mealTemplate.dayOfWeek,
      grams,
      foodId: l.mealTemplate.foodId,
      macros: round1(macros),
    };
  });
  const eaten = logsOut.filter((l) => l.isEaten);
  const consumed =
    eaten.length > 0 ? round1(sumMacros(eaten.map((l) => l.macros))) : null;

  const presentSession = (s: (typeof sessions)[number]) =>
    Object.assign({}, s, {
      sets: s.sets.map((x) => Object.assign({}, x, { weightKg: num(x.weightKg) })),
    });

  const todayRow = scores.find((s) => s.date === date) ?? null;
  const streak = computeStreak(
    streakRows.map((r) => ({
      date: r.date,
      kept: r.kept,
      scored: r.outcomeScore !== null,
    })),
    date
  );

  return {
    date,
    weekday,
    serverTime: new Date().toISOString(),
    dataEpoch: user.dataEpoch,
    counts: counts[0],
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      age: user.age,
      weight: num(user.weight),
      heightCm: user.heightCm,
      sex: user.sex,
      createdAt: user.createdAt,
    },
    preferences: prefs,
    schedule: { blocks, completions },
    supplements: { items: supplements, logs: supplementLogs },
    meals: { templates: mealOut, logs: logsOut, consumed },
    program: {
      selected: selected
        ? {
            id: selected.id,
            name: selected.name,
            goal: selected.goal,
            isSystem: selected.isSystem,
            days: selected.days.map((d) => ({
              id: d.id,
              name: d.name,
              dayOrder: d.dayOrder,
              weekdays: d.weekdays,
            })),
          }
        : null,
      today: todayDay,
      plan,
    },
    workout: {
      sessions: sessions.map(presentSession),
      open: openSession ? presentSession(openSession) : null,
    },
    dailyLog,
    score: {
      today: presentScore(todayRow),
      streak,
      history: scores.map(presentScore),
    },
  };
}
