// Bets 1 + 5: server-computed Outcome Score / streak, and GET /api/today.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { addDays } from '../src/utils/dates.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';

const DATE = '2026-10-17'; // Saturday, ISO weekday 6
let u: TestUser;
let userId: string;
let mealId: string;
let sessionId: string;

beforeAll(async () => {
  u = await registerUser();
  userId = (await http().get('/api/auth/me').set(auth(u))).body.data.user.id;
  const programId = randomUUID();
  await http()
    .post('/api/programs')
    .set(auth(u))
    .send({
      id: programId,
      name: 'Weekend',
      goal: 'strength',
      days: [
        {
          name: 'Sat',
          weekdays: [6],
          exercises: [{ exerciseName: 'Squat', sets: '3', reps: '5' }],
        },
        {
          name: 'Tue',
          weekdays: [2],
          exercises: [{ exerciseName: 'Bench', sets: '3', reps: '5' }],
        },
      ],
    });
  await http().put('/api/preferences').set(auth(u)).send({
    selectedProgramId: programId,
    proteinTargetG: 160,
    calorieTargetKcal: 2500,
  });
  mealId = (
    await http()
      .post('/api/meals/templates')
      .set(auth(u))
      .send({
        dayOfWeek: 'Saturday',
        name: 'Big meal',
        grams: 200,
        foodId: 'f1',
        // per-100 g values, scaled by grams/100 like the app does
        tags: [
          { label: 'Protein', value: '80' },
          { label: 'Calories', value: '1250' },
        ],
      })
  ).body.data.id;
  await http()
    .post('/api/schedule')
    .set(auth(u))
    .send({ start: '07:00', end: '07:30', title: 'X' });
});

describe('server-computed DailyScore', () => {
  it('nothing eaten yet → unscored; plan comes from program weekdays', async () => {
    const res = await http().get(`/api/today?date=${DATE}`).set(auth(u));
    expect(res.status).toBe(200);
    expect(res.body.data.score.today.outcomeScore).toBeNull();
    expect(res.body.data.score.today.plan).toBe('train');
    expect(res.body.data.score.today.setsPlanned).toBe(3);
    expect(res.body.data.program.today.name).toBe('Sat');
    expect(res.body.data.program.plan.source).toBe('weekdays');
  });

  it('eating to target + finishing the planned sets → 100, kept', async () => {
    await http()
      .post(`/api/meals/${mealId}/log`)
      .set(auth(u))
      .send({ date: DATE, isEaten: true });
    sessionId = randomUUID();
    await http()
      .post('/api/workouts/sessions')
      .set(auth(u))
      .send({ id: sessionId, date: DATE, programDayName: 'Sat' });
    for (let n = 1; n <= 3; n++) {
      await http()
        .post(`/api/workouts/sessions/${sessionId}/sets`)
        .set(auth(u))
        .send({ exerciseName: 'Squat', setNumber: n, weightKg: 100, reps: 5 });
    }
    const row = await prisma.dailyScore.findUniqueOrThrow({
      where: { userId_date: { userId, date: DATE } },
    });
    expect(row.outcomeScore).toBe(100);
    expect(row.kept).toBe(true);
    expect(row.protein).toBe(160);
    expect(row.calories).toBe(2500);
    expect(row.setsDone).toBe(3);
    expect(row.workoutDone).toBe(true);
    expect(row.routinePct).toBe(50); // 1 of 2 routine items (block not ticked, meal eaten)
    expect(row.computedAt).not.toBeNull();
  });

  it('a stale device posting zeros cannot clobber the score (audit 02 finding 4)', async () => {
    const res = await http().post('/api/scores').set(auth(u)).send({
      date: DATE,
      score: 0,
      tasksDone: 0,
      workoutDone: false,
      protein: 0,
      calories: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.outcomeScore).toBe(100);
    const row = await prisma.dailyScore.findUniqueOrThrow({
      where: { userId_date: { userId, date: DATE } },
    });
    expect([row.protein, row.workoutDone, row.outcomeScore]).toEqual([160, true, 100]);
  });

  it('POST /scores validates the date', async () => {
    const res = await http()
      .post('/api/scores')
      .set(auth(u))
      .send({ date: '2026-02-31' });
    expect(res.status).toBe(400);
  });

  it('GET /scores keeps the v1 array shape; v2 adds today + streak', async () => {
    // Two earlier kept days → streak 3 including today.
    for (const d of [addDays(DATE, -1), addDays(DATE, -2)]) {
      await prisma.dailyScore.create({
        data: {
          userId,
          date: d,
          score: 90,
          outcomeScore: 95,
          kept: true,
          computedAt: new Date(),
        },
      });
    }
    await prisma.userPreferences.update({ where: { userId }, data: { timezone: 'UTC' } });
    const v1 = await http().get('/api/scores?days=400').set(auth(u));
    expect(Array.isArray(v1.body.data)).toBe(true);
    const v2 = await http().get('/api/scores?v=2&days=30').set(auth(u));
    expect(v2.status).toBe(200);
    expect(v2.body.data).toHaveProperty('streak');
    expect(v2.body.data).toHaveProperty('days');
    // Streak through the user's real today; the seeded dates are in the past
    // unless the test runs on 2026-10-17, so only check the shape there.
    expect(['kept', 'pending', 'none']).toContain(v2.body.data.streak.state);

    const today = await http().get(`/api/today?date=${DATE}`).set(auth(u));
    expect(today.body.data.score.streak).toEqual({
      count: 3,
      state: 'kept',
      graceUsedThisWeek: false,
    });
    expect(today.body.data.score.history.map((s: { date: string }) => s.date)).toEqual([
      addDays(DATE, -2),
      addDays(DATE, -1),
      DATE,
    ]);
  });
});

describe('GET /api/today', () => {
  it('returns everything Focus needs in one response', async () => {
    const res = await http().get(`/api/today?date=${DATE}`).set(auth(u));
    const d = res.body.data;
    expect(d.date).toBe(DATE);
    expect(d.weekday).toBe('Saturday');
    expect(typeof d.dataEpoch).toBe('string');
    expect(typeof d.serverTime).toBe('string');
    expect(d.counts).toMatchObject({
      scheduleBlocks: 1,
      mealTemplates: 1,
      workoutSessions: 1,
    });
    expect(d.user.email).toBe(u.email);
    expect(d.preferences.proteinTargetG).toBe(160);
    expect(d.schedule.blocks).toHaveLength(1);
    expect(d.meals.templates[0]).toMatchObject({ grams: 200, foodId: 'f1' });
    expect(d.meals.logs[0]).toMatchObject({
      mealTemplateId: mealId,
      isEaten: true,
      grams: 200,
      foodId: 'f1',
      macros: { protein: 160, calories: 2500 },
    });
    expect(d.meals.consumed).toMatchObject({ protein: 160, calories: 2500 });
    expect(d.workout.sessions[0].sets).toHaveLength(3);
    expect(d.workout.sessions[0].sets[0].weightKg).toBe(100);
    expect(d.workout.open?.id).toBe(sessionId); // not finished yet
    expect(d.score.today).toMatchObject({
      outcomeScore: 100,
      kept: true,
      routinePct: 50,
    });
  });

  it('defaults the date to the user’s local today and rejects bad dates', async () => {
    const res = await http().get('/api/today').set(auth(u));
    expect(res.status).toBe(200);
    expect(res.body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await http().get('/api/today?date=2026-13-01').set(auth(u))).status).toBe(
      400
    );
  });

  it('an unknown account (server data lost) answers 401 ACCOUNT_NOT_FOUND', async () => {
    const gone = await registerUser();
    const me = await http().get('/api/auth/me').set(auth(gone));
    await prisma.user.delete({ where: { id: me.body.data.user.id } });
    const res = await http().get(`/api/today?date=${DATE}`).set(auth(gone));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('dataEpoch is stable per account and differs between accounts', async () => {
    const a = (await http().get(`/api/today?date=${DATE}`).set(auth(u))).body.data
      .dataEpoch;
    const b = (await http().get(`/api/today?date=${DATE}`).set(auth(u))).body.data
      .dataEpoch;
    const other = await registerUser();
    const c = (await http().get(`/api/today?date=${DATE}`).set(auth(other))).body.data
      .dataEpoch;
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});
