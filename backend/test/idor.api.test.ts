import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';
import { listRoutes } from './routeTable.js';

/**
 * IDOR matrix (audit F2/F3/F12). User A owns one of every resource; user B
 * calls every route that takes an id (path param or body reference) with A's
 * ids. Every call must answer 404/403, and A's rows must be byte-identical
 * afterwards. The route list comes from the Express stack, so a new `:param`
 * route fails this test until it is added to the matrix.
 */

const DATE = '2026-10-17';

interface Ids {
  block: string;
  supplement: string;
  template: string;
  log: string;
  logDate: string;
  program: string;
  session: string;
  set: string;
  userFood: string;
}

type Call = { url: (ids: Ids) => string; body?: (ids: Ids) => object };

const programBody = {
  name: 'Hijacked',
  goal: 'general',
  days: [{ name: 'Day', exercises: [{ exerciseName: 'Squat', sets: '3', reps: '5' }] }],
};

/** Keyed by "METHOD /api/path" exactly as the router declares it. */
const MATRIX: Record<string, Call> = {
  'PUT /api/schedule/:id': {
    url: (i) => `/api/schedule/${i.block}`,
    body: () => ({ title: 'x' }),
  },
  'DELETE /api/schedule/:id': { url: (i) => `/api/schedule/${i.block}` },
  'PUT /api/supplements/:id': {
    url: (i) => `/api/supplements/${i.supplement}`,
    body: () => ({ item: 'x' }),
  },
  'DELETE /api/supplements/:id': { url: (i) => `/api/supplements/${i.supplement}` },
  'POST /api/supplements/:id/log': {
    url: (i) => `/api/supplements/${i.supplement}/log`,
    body: () => ({ date: DATE, isTaken: true }),
  },
  'PUT /api/meals/templates/:id': {
    url: (i) => `/api/meals/templates/${i.template}`,
    body: () => ({ name: 'x', tags: [{ label: 'Protein', value: '1' }] }),
  },
  'PATCH /api/meals/templates/:id/grams': {
    url: (i) => `/api/meals/templates/${i.template}/grams`,
    body: () => ({ grams: 500 }),
  },
  'DELETE /api/meals/templates/:id': { url: (i) => `/api/meals/templates/${i.template}` },
  'POST /api/meals/:id/log': {
    url: (i) => `/api/meals/${i.template}/log`,
    body: () => ({ date: DATE, isEaten: true }),
  },
  'GET /api/logs/:date': { url: (i) => `/api/logs/${i.logDate}` },
  'DELETE /api/logs/:id': { url: (i) => `/api/logs/${i.log}` },
  'GET /api/programs/:id': { url: (i) => `/api/programs/${i.program}` },
  'PUT /api/programs/:id': {
    url: (i) => `/api/programs/${i.program}`,
    body: () => programBody,
  },
  'DELETE /api/programs/:id': { url: (i) => `/api/programs/${i.program}` },
  'POST /api/workouts/sessions/:id/sets': {
    url: (i) => `/api/workouts/sessions/${i.session}/sets`,
    body: () => ({ exerciseName: 'Squat', setNumber: 9, weightKg: 1, reps: 1 }),
  },
  'PATCH /api/workouts/sessions/:id/finish': {
    url: (i) => `/api/workouts/sessions/${i.session}/finish`,
    body: () => ({ durationSeconds: 1 }),
  },
  'DELETE /api/workouts/sets/:id': { url: (i) => `/api/workouts/sets/${i.set}` },
  'DELETE /api/user-foods/:id': { url: (i) => `/api/user-foods/${i.userFood}` },
};

/** Routes whose body references another record by id. */
const BODY_REFERENCES: Record<string, Call> = {
  'POST /api/schedule/completions': {
    url: () => '/api/schedule/completions',
    body: (i) => ({ blockId: i.block, date: DATE, isComplete: true }),
  },
  'PUT /api/preferences (selectedProgramId)': {
    url: () => '/api/preferences',
    body: (i) => ({ selectedProgramId: i.program }),
  },
};

/** Param routes that are deliberately not user-owned. */
const EXEMPT: Record<string, string> = {
  'GET /api/foods/:id': 'global reference data (Food), readable by every user',
  'PATCH /api/logs/:date':
    'keyed by date, not by a record id: always writes the caller’s own DailyLog row',
};

async function snapshot(userId: string) {
  const where = { userId };
  const byId = { id: 'asc' as const };
  return JSON.stringify({
    blocks: await prisma.scheduleBlock.findMany({ where, orderBy: byId }),
    completions: await prisma.completion.findMany({ where, orderBy: byId }),
    supplements: await prisma.supplement.findMany({ where, orderBy: byId }),
    supplementLogs: await prisma.supplementLog.findMany({ where, orderBy: byId }),
    templates: await prisma.mealTemplate.findMany({
      where,
      orderBy: byId,
      include: { tags: { orderBy: byId } },
    }),
    mealLogs: await prisma.mealLog.findMany({ where, orderBy: byId }),
    logs: await prisma.dailyLog.findMany({ where, orderBy: byId }),
    programs: await prisma.gymProgram.findMany({
      where,
      orderBy: byId,
      include: { days: { orderBy: byId, include: { exercises: { orderBy: byId } } } },
    }),
    sessions: await prisma.workoutSession.findMany({ where, orderBy: byId }),
    sets: await prisma.workoutSetLog.findMany({ where, orderBy: byId }),
    userFoods: await prisma.userFood.findMany({ where, orderBy: byId }),
    prefs: await prisma.userPreferences.findMany({ where }),
  });
}

async function ok(res: { status: number; body: unknown }, expected = [200, 201]) {
  if (!expected.includes(res.status)) {
    throw new Error(`setup call failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as { data: { id: string } };
}

describe('IDOR matrix: user B against user A ids', () => {
  let a: TestUser;
  let b: TestUser;
  let aId: string;
  let bId: string;
  const ids = {} as Ids;

  beforeAll(async () => {
    a = await registerUser();
    b = await registerUser();
    aId = (await http().get('/api/auth/me').set(auth(a))).body.data.user.id;
    bId = (await http().get('/api/auth/me').set(auth(b))).body.data.user.id;
    const A = auth(a);

    const food = await prisma.food.create({
      data: { name: `IDOR food ${Date.now()}`, proteinPer100g: 20, caloriesPer100g: 100 },
    });

    ids.block = (
      await ok(
        await http()
          .post('/api/schedule')
          .set(A)
          .send({ start: '08:00', end: '09:00', title: 'A block' })
      )
    ).data.id;
    await ok(
      await http()
        .post('/api/schedule/completions')
        .set(A)
        .send({ blockId: ids.block, date: DATE, isComplete: true })
    );
    ids.supplement = (
      await ok(await http().post('/api/supplements').set(A).send({ item: 'A creatine' }))
    ).data.id;
    await ok(
      await http()
        .post(`/api/supplements/${ids.supplement}/log`)
        .set(A)
        .send({ date: DATE, isTaken: true })
    );
    ids.template = (
      await ok(
        await http()
          .post('/api/meals/templates')
          .set(A)
          .send({
            dayOfWeek: 'Mon',
            name: 'A meal',
            foodId: food.id,
            grams: 100,
            tags: [{ label: 'Protein', value: '20' }],
          })
      )
    ).data.id;
    await ok(
      await http()
        .post(`/api/meals/${ids.template}/log`)
        .set(A)
        .send({ date: DATE, isEaten: true })
    );
    ids.logDate = DATE;
    ids.log = (
      await ok(await http().post('/api/logs').set(A).send({ date: DATE, bw: '80' }))
    ).data.id;
    ids.program = (
      await ok(
        await http()
          .post('/api/programs')
          .set(A)
          .send(Object.assign({}, programBody, { name: 'A program' }))
      )
    ).data.id;
    ids.session = (
      await ok(await http().post('/api/workouts/sessions').set(A).send({ date: DATE }))
    ).data.id;
    ids.set = (
      await ok(
        await http()
          .post(`/api/workouts/sessions/${ids.session}/sets`)
          .set(A)
          .send({ exerciseName: 'Squat', setNumber: 1, weightKg: 100, reps: 5 })
      )
    ).data.id;
    ids.userFood = (
      await ok(await http().post('/api/user-foods').set(A).send({ foodId: food.id }))
    ).data.id;
  });

  it('covers every parameterised route in the router', () => {
    const paramRoutes = listRoutes(app)
      .filter((r) => r.path.includes(':'))
      .map((r) => r.key);
    expect(paramRoutes.length).toBeGreaterThan(0);
    const missing = paramRoutes.filter((k) => !MATRIX[k] && !EXEMPT[k]);
    expect(missing).toEqual([]);
    const stale = Object.keys(MATRIX).filter((k) => !paramRoutes.includes(k));
    expect(stale).toEqual([]);
  });

  const cases = Object.entries(MATRIX).concat(Object.entries(BODY_REFERENCES));

  it.each(cases)('%s with A ids -> 404/403 for B', async (key, call) => {
    const before = await snapshot(aId);
    const [method, ...rest] = key.split(' ');
    void rest;
    const url = call.url(ids);
    const agent = http();
    const req =
      method === 'GET'
        ? agent.get(url)
        : method === 'POST'
          ? agent.post(url)
          : method === 'PUT'
            ? agent.put(url)
            : method === 'PATCH'
              ? agent.patch(url)
              : agent.delete(url);
    req.set(auth(b));
    if (call.body) req.send(call.body(ids));
    const res = await req;
    expect([403, 404], `${key} -> ${res.status} ${JSON.stringify(res.body)}`).toContain(
      res.status
    );
    // Nothing leaked in the body either.
    expect(JSON.stringify(res.body)).not.toContain(aId);
    expect(await snapshot(aId)).toBe(before);
  });

  it('B ends up with no rows pointing at A records', async () => {
    expect(await prisma.supplementLog.count({ where: { userId: bId } })).toBe(0);
    expect(await prisma.mealLog.count({ where: { userId: bId } })).toBe(0);
    expect(await prisma.completion.count({ where: { userId: bId } })).toBe(0);
    expect(await prisma.workoutSetLog.count({ where: { userId: bId } })).toBe(0);
  });

  it('A still sees all of its own data', async () => {
    const A = auth(a);
    expect((await http().get(`/api/programs/${ids.program}`).set(A)).status).toBe(200);
    expect((await http().get(`/api/logs/${DATE}`).set(A)).status).toBe(200);
    const templates = await http().get('/api/meals/templates').set(A);
    expect(templates.body.data[0].tags).toHaveLength(1);
  });
});
