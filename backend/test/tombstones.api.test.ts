// Delete tombstones (docs/log/backend-sync-api.md §2.3): a delete is final. A
// later create / edit / toggle / set naming the deleted id gets 410 Gone and
// changes nothing; /today and export v2 never show it again; tombstones travel
// through export/import v2 so a rehydrated server cannot resurrect rows either.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { formatHlc } from '../src/utils/hlc.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';

let u: TestUser;
let userId: string;
let foodId: string;
const DATE = '2026-10-17';
const T0 = Date.now() - 3_600_000;
const h = (ms: number, dev = 'devA') => formatHlc(T0 + ms, 0, dev);

const programBody = (id?: string, dayId?: string, exId?: string) => ({
  id,
  name: 'P',
  goal: 'general',
  days: [
    {
      id: dayId,
      name: 'Day A',
      exercises: [{ id: exId, exerciseName: 'Squat', sets: '3', reps: '5' }],
    },
  ],
});

beforeAll(async () => {
  u = await registerUser();
  userId = (await http().get('/api/auth/me').set(auth(u))).body.data.user.id;
  foodId = (
    await prisma.food.create({
      data: { name: `Tomb food ${Date.now()}`, proteinPer100g: 10, caloriesPer100g: 50 },
    })
  ).id;
});

type Case = {
  entity: string;
  path: string;
  create: (id: string) => object;
  /** DELETE url for the row */
  del: (id: string) => string;
  exists: (id: string) => Promise<boolean>;
};

const cases: Case[] = [
  {
    entity: 'block',
    path: '/api/schedule',
    create: (id) => ({ id, start: '07:00', end: '07:30', title: 'T' }),
    del: (id) => `/api/schedule/${id}`,
    exists: async (id) => (await prisma.scheduleBlock.count({ where: { id } })) > 0,
  },
  {
    entity: 'supplement',
    path: '/api/supplements',
    create: (id) => ({ id, item: 'Zinc' }),
    del: (id) => `/api/supplements/${id}`,
    exists: async (id) => (await prisma.supplement.count({ where: { id } })) > 0,
  },
  {
    entity: 'meal',
    path: '/api/meals/templates',
    create: (id) => ({ id, dayOfWeek: 'Saturday', name: 'Oats' }),
    del: (id) => `/api/meals/templates/${id}`,
    exists: async (id) => (await prisma.mealTemplate.count({ where: { id } })) > 0,
  },
  {
    entity: 'program',
    path: '/api/programs',
    create: (id) => programBody(id),
    del: (id) => `/api/programs/${id}`,
    exists: async (id) => (await prisma.gymProgram.count({ where: { id } })) > 0,
  },
  {
    entity: 'session',
    path: '/api/workouts/sessions',
    create: (id) => ({ id, date: DATE }),
    del: (id) => `/api/workouts/sessions/${id}`,
    exists: async (id) => (await prisma.workoutSession.count({ where: { id } })) > 0,
  },
  {
    entity: 'userFood',
    path: '/api/user-foods',
    create: (id) => ({ id, foodId }),
    del: (id) => `/api/user-foods/${id}`,
    exists: async (id) => (await prisma.userFood.count({ where: { id } })) > 0,
  },
];

describe('tombstones: a delayed create retry after a delete', () => {
  for (const c of cases) {
    it(`${c.entity}: create → delete → create replay = 410, row stays gone`, async () => {
      const id = randomUUID();
      const created = await http().post(c.path).set(auth(u)).send(c.create(id));
      expect([200, 201]).toContain(created.status);
      const del = await http()
        .delete(c.del(id))
        .set(auth(u))
        .send({ hlc: h(1000) });
      expect(del.status).toBe(200);
      expect(await c.exists(id)).toBe(false);
      const ts = await prisma.tombstone.findMany({ where: { userId, entityId: id } });
      expect(ts).toHaveLength(1);
      expect(ts[0]).toMatchObject({ entity: c.entity, hlc: h(1000) });

      // The other device's create retry arrives after the delete.
      const replay = await http().post(c.path).set(auth(u)).send(c.create(id));
      expect(replay.status).toBe(410);
      expect(replay.body.success).toBe(false);
      expect(await c.exists(id)).toBe(false);

      // A repeated delete is still "not found" (nothing to delete).
      expect((await http().delete(c.del(id)).set(auth(u))).status).toBe(404);
    });
  }

  it('delete without hlc records a server stamp', async () => {
    const id = randomUUID();
    await http()
      .post('/api/schedule')
      .set(auth(u))
      .send({ id, start: '07:00', end: '07:30', title: 'T' });
    expect((await http().delete(`/api/schedule/${id}`).set(auth(u))).status).toBe(200);
    const t = await prisma.tombstone.findFirstOrThrow({ where: { entityId: id } });
    expect(t.hlc).toMatch(/^\d{13}-0000-server$/);
  });

  it('rejects a malformed delete hlc', async () => {
    const id = randomUUID();
    await http().post('/api/supplements').set(auth(u)).send({ id, item: 'x' });
    const res = await http()
      .delete(`/api/supplements/${id}`)
      .set(auth(u))
      .send({ hlc: 'yesterday' });
    expect(res.status).toBe(400);
    expect(await prisma.supplement.count({ where: { id } })).toBe(1);
  });
});

describe('tombstones: edits, toggles and sets on a deleted target', () => {
  it('PUT and toggles on a deleted block / supplement / meal answer 410', async () => {
    const block = randomUUID();
    const supp = randomUUID();
    const meal = randomUUID();
    await http()
      .post('/api/schedule')
      .set(auth(u))
      .send({ id: block, start: '07:00', end: '07:30', title: 'T' });
    await http().post('/api/supplements').set(auth(u)).send({ id: supp, item: 'S' });
    await http()
      .post('/api/meals/templates')
      .set(auth(u))
      .send({ id: meal, dayOfWeek: 'Saturday', name: 'M' });
    await http().delete(`/api/schedule/${block}`).set(auth(u));
    await http().delete(`/api/supplements/${supp}`).set(auth(u));
    await http().delete(`/api/meals/templates/${meal}`).set(auth(u));

    const calls = [
      http()
        .put(`/api/schedule/${block}`)
        .set(auth(u))
        .send({ title: 'x', hlc: h(5) }),
      http()
        .put(`/api/supplements/${supp}`)
        .set(auth(u))
        .send({ dose: '1', hlc: h(5) }),
      http().put(`/api/meals/templates/${meal}`).set(auth(u)).send({ name: 'x' }),
      http()
        .post('/api/schedule/completions')
        .set(auth(u))
        .send({ blockId: block, date: DATE, isComplete: true, hlc: h(5) }),
      http()
        .post(`/api/supplements/${supp}/log`)
        .set(auth(u))
        .send({ date: DATE, isTaken: true }),
      http()
        .post(`/api/meals/${meal}/log`)
        .set(auth(u))
        .send({ date: DATE, isEaten: true }),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(410);
    // An id that never existed is still a plain 404.
    const missing = await http()
      .put(`/api/schedule/${randomUUID()}`)
      .set(auth(u))
      .send({ title: 'x' });
    expect(missing.status).toBe(404);
  });

  it('a one-off food whose template was deleted is not re-created', async () => {
    const id = randomUUID();
    const body = { id, date: DATE, name: 'Kebab', tags: [] };
    expect((await http().post('/api/meals/one-off').set(auth(u)).send(body)).status).toBe(
      201
    );
    await http().delete(`/api/meals/templates/${id}`).set(auth(u));
    expect((await http().post('/api/meals/one-off').set(auth(u)).send(body)).status).toBe(
      410
    );
    expect(await prisma.mealTemplate.count({ where: { id } })).toBe(0);
  });

  it('deleting a session tombstones its sets; late sets and finish answer 410', async () => {
    const session = randomUUID();
    const set1 = randomUUID();
    await http()
      .post('/api/workouts/sessions')
      .set(auth(u))
      .send({ id: session, date: DATE });
    await http()
      .post(`/api/workouts/sessions/${session}/sets`)
      .set(auth(u))
      .send({ id: set1, exerciseName: 'Squat', setNumber: 1, weightKg: 100, reps: 5 });
    const del = await http().delete(`/api/workouts/sessions/${session}`).set(auth(u));
    expect(del.status).toBe(200);
    expect(await prisma.workoutSetLog.count({ where: { sessionId: session } })).toBe(0);
    expect(
      (
        await prisma.tombstone.findMany({
          where: { userId, entityId: { in: [session, set1] } },
        })
      )
        .map((t) => t.entity)
        .sort()
    ).toEqual(['session', 'set']);

    const lateSet = await http()
      .post(`/api/workouts/sessions/${session}/sets`)
      .set(auth(u))
      .send({
        id: randomUUID(),
        exerciseName: 'Squat',
        setNumber: 2,
        weightKg: 1,
        reps: 1,
      });
    expect(lateSet.status).toBe(410);
    const finish = await http()
      .patch(`/api/workouts/sessions/${session}/finish`)
      .set(auth(u))
      .send({ durationSeconds: 1 });
    expect(finish.status).toBe(410);
    expect(await prisma.workoutSession.count({ where: { id: session } })).toBe(0);
    expect(
      (await http().delete(`/api/workouts/sessions/${randomUUID()}`).set(auth(u))).status
    ).toBe(404);
  });

  it('an undone set is not resurrected by a delayed retry of its POST', async () => {
    const session = randomUUID();
    const setId = randomUUID();
    await http()
      .post('/api/workouts/sessions')
      .set(auth(u))
      .send({ id: session, date: DATE });
    const body = {
      id: setId,
      exerciseName: 'Bench',
      setNumber: 1,
      weightKg: 60,
      reps: 8,
    };
    await http().post(`/api/workouts/sessions/${session}/sets`).set(auth(u)).send(body);
    expect((await http().delete(`/api/workouts/sets/${setId}`).set(auth(u))).status).toBe(
      200
    );
    const retry = await http()
      .post(`/api/workouts/sessions/${session}/sets`)
      .set(auth(u))
      .send(body);
    expect(retry.status).toBe(410);
    expect(await prisma.workoutSetLog.count({ where: { id: setId } })).toBe(0);
    // A new set (new id) with the same number is a different set: allowed.
    const redo = await http()
      .post(`/api/workouts/sessions/${session}/sets`)
      .set(auth(u))
      .send(Object.assign({}, body, { id: randomUUID() }));
    expect(redo.status).toBe(201);
  });

  it('a deleted program tombstones its days and exercises', async () => {
    const [pid, did, eid] = [randomUUID(), randomUUID(), randomUUID()];
    await http()
      .post('/api/programs')
      .set(auth(u))
      .send(programBody(pid, did, eid));
    await http().delete(`/api/programs/${pid}`).set(auth(u));
    const ents = (
      await prisma.tombstone.findMany({
        where: { userId, entityId: { in: [pid, did, eid] } },
      })
    )
      .map((t) => t.entity)
      .sort();
    expect(ents).toEqual(['program', 'programDay', 'programExercise']);
    const put = await http()
      .put(`/api/programs/${pid}`)
      .set(auth(u))
      .send(programBody(undefined, did, eid));
    expect(put.status).toBe(410);
    // Re-using a deleted day id inside a new program is refused too.
    const reuse = await http()
      .post('/api/programs')
      .set(auth(u))
      .send(programBody(randomUUID(), did));
    expect(reuse.status).toBe(410);
  });

  it('a saved food can be saved again under a new id', async () => {
    const id = randomUUID();
    await http().post('/api/user-foods').set(auth(u)).send({ id, foodId });
    await http().delete(`/api/user-foods/${id}`).set(auth(u));
    const again = await http()
      .post('/api/user-foods')
      .set(auth(u))
      .send({ id: randomUUID(), foodId });
    expect(again.status).toBe(200);
  });
});

describe('tombstones in /today and backup v2', () => {
  it('/today and export v2 exclude deleted rows; export carries the tombstones', async () => {
    const v = await registerUser();
    const block = randomUUID();
    const keep = randomUUID();
    for (const id of [block, keep])
      await http()
        .post('/api/schedule')
        .set(auth(v))
        .send({ id, start: '07:00', end: '07:30', title: id.slice(0, 4) });
    await http()
      .delete(`/api/schedule/${block}`)
      .set(auth(v))
      .send({ hlc: h(9) });

    const today = (await http().get(`/api/today?date=${DATE}`).set(auth(v))).body.data;
    expect(today.schedule.blocks.map((b: { id: string }) => b.id)).toEqual([keep]);
    const exp = (await http().get('/api/sync/export?v=2').set(auth(v))).body.data;
    expect(exp.scheduleBlocks.map((b: { id: string }) => b.id)).toEqual([keep]);
    expect(exp.tombstones).toEqual([
      expect.objectContaining({ entity: 'block', entityId: block, hlc: h(9) }),
    ]);
  });

  it('import v2 applies tombstones: skips and deletes tombstoned rows, idempotent', async () => {
    const v = await registerUser();
    const vId = (await http().get('/api/auth/me').set(auth(v))).body.data.user.id;
    const live = randomUUID();
    const dead = randomUUID();
    for (const id of [live, dead])
      await http()
        .post('/api/schedule')
        .set(auth(v))
        .send({ id, start: '07:00', end: '07:30', title: 'x' });
    const before = (await http().get('/api/sync/export?v=2').set(auth(v))).body.data;

    // Another device deleted `dead`; its newer backup carries the tombstone but
    // the (older) row list still has it: the tombstone wins.
    const backup = Object.assign({}, before, {
      tombstones: [
        {
          entity: 'block',
          entityId: dead,
          hlc: h(20),
          deletedAt: new Date().toISOString(),
        },
      ],
    });
    const res = await http().post('/api/sync/import?v=2').set(auth(v)).send(backup);
    expect(res.status).toBe(200);
    expect(res.body.data.created.tombstones).toBe(1);
    expect(res.body.data.skipped.scheduleBlocks).toBe(1);
    expect(await prisma.scheduleBlock.count({ where: { id: dead } })).toBe(0);
    expect(await prisma.scheduleBlock.count({ where: { id: live } })).toBe(1);

    const again = await http().post('/api/sync/import?v=2').set(auth(v)).send(backup);
    expect(again.body.data.created.tombstones).toBe(0);
    expect(again.body.data.created.scheduleBlocks).toBe(0);
    expect(await prisma.tombstone.count({ where: { userId: vId } })).toBe(1);
    // Rehydrated server: a create replay of the deleted id is refused.
    const replay = await http()
      .post('/api/schedule')
      .set(auth(v))
      .send({ id: dead, start: '07:00', end: '07:30', title: 'x' });
    expect(replay.status).toBe(410);
  });

  it('a tombstone owned by another account does not block or leak', async () => {
    const other = await registerUser();
    const id = randomUUID();
    await http()
      .post('/api/schedule')
      .set(auth(other))
      .send({ id, start: '07:00', end: '07:30', title: 'x' });
    // u cannot delete it (404) and therefore records nothing.
    expect((await http().delete(`/api/schedule/${id}`).set(auth(u))).status).toBe(404);
    expect(await prisma.tombstone.count({ where: { entityId: id } })).toBe(0);
  });
});
