// The server-side break cases reproduced in docs/audit/02-sync-offline.md,
// each pinned as a regression test (numbers refer to that document).
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { localDateKey } from '../src/utils/dates.js';
import { formatHlc } from '../src/utils/hlc.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';

let A: TestUser; // device A and B are two sessions of one user
let B: TestUser;
let userId: string;
let blockId: string;
const T0 = Date.parse('2026-10-17T08:00:00Z');
const h = (ms: number, dev: string) => formatHlc(T0 + ms, 0, dev);

beforeAll(async () => {
  A = await registerUser();
  const login = await http()
    .post('/api/auth/login')
    .send({ email: A.email, password: A.password });
  B = Object.assign({}, A, { accessToken: login.body.data.accessToken });
  userId = (await http().get('/api/auth/me').set(auth(A))).body.data.user.id;
  blockId = (
    await http()
      .post('/api/schedule')
      .set(auth(A))
      .send({ start: '07:00', end: '07:15', title: 'Wake' })
  ).body.data.id;
});

describe('audit 02 regressions', () => {
  it('R1 §2.1 duplicate POSTs of creates no longer duplicate rows', async () => {
    const sid = randomUUID();
    const start = { id: sid, date: '2026-10-17' };
    for (let i = 0; i < 3; i++)
      await http().post('/api/workouts/sessions').set(auth(A)).send(start);
    for (let i = 0; i < 2; i++) {
      // the current app sends no id for sets: the natural key dedupes them
      await http()
        .post(`/api/workouts/sessions/${sid}/sets`)
        .set(auth(A))
        .send({ exerciseName: 'Bench', setNumber: 1, weightKg: 80, reps: 5 });
    }
    expect(await prisma.workoutSession.count({ where: { id: sid } })).toBe(1);
    expect(await prisma.workoutSetLog.count({ where: { sessionId: sid } })).toBe(1);
  });

  it('R2 §2.2 server committed but the client never saw it: retry is safe', async () => {
    const id = randomUUID();
    const body = { id, start: '12:00', end: '12:30', title: 'Lunch' };
    const req = http().post('/api/schedule').set(auth(A)).send(body);
    await req; // response "lost": the client does not know it succeeded
    const retry = await http().post('/api/schedule').set(auth(A)).send(body);
    expect(retry.status).toBe(200);
    expect(await prisma.scheduleBlock.count({ where: { userId, title: 'Lunch' } })).toBe(
      1
    );
  });

  it('R3 §2.3 on/off tap race with jitter ends in the last tap, every time', async () => {
    for (let trial = 0; trial < 30; trial++) {
      const date = `2026-08-${String(trial + 1).padStart(2, '0')}`;
      const on = () =>
        http()
          .post('/api/schedule/completions')
          .set(auth(A))
          .send({ blockId, date, isComplete: true, hlc: h(trial * 100, 'A') });
      const off = () =>
        http()
          .post('/api/schedule/completions')
          .set(auth(A))
          .send({ blockId, date, isComplete: false, hlc: h(trial * 100 + 60, 'A') });
      const jitter = () => new Promise((r) => setTimeout(r, Math.random() * 20));
      await Promise.all([jitter().then(on), jitter().then(off)]);
      const row = await prisma.completion.findFirstOrThrow({ where: { blockId, date } });
      expect(row.isComplete).toBe(false);
    }
  });

  it('R4 §2.4 offline queue replaying a stale ON after a newer OFF', async () => {
    const date = '2026-09-10';
    const send = (isComplete: boolean, hlc: string) =>
      http()
        .post('/api/schedule/completions')
        .set(auth(A))
        .send({ blockId, date, isComplete, hlc });
    await send(false, h(5000, 'A')); // online OFF succeeds
    await send(true, h(1000, 'A')); // queued ON flushed later
    expect(
      (await prisma.completion.findFirstOrThrow({ where: { blockId, date } })).isComplete
    ).toBe(false);
  });

  it('R5 §2.5 impossible dates are rejected', async () => {
    for (const date of ['2026-02-31', '2026-13-45', '9999-99-99', '1970-01-01']) {
      const c = await http()
        .post('/api/schedule/completions')
        .set(auth(A))
        .send({ blockId, date, isComplete: true });
      const s = await http().post('/api/scores').set(auth(A)).send({ date, score: 1 });
      const l = await http().post('/api/logs').set(auth(A)).send({ date, bw: '80' });
      const w = await http().post('/api/workouts/sessions').set(auth(A)).send({ date });
      expect([c.status, s.status, l.status, w.status]).toEqual([400, 400, 400, 400]);
    }
  });

  it('R5b §2.5 server "today" uses the user timezone, not UTC', async () => {
    await http()
      .put('/api/preferences')
      .set(auth(A))
      .send({ timezone: 'Pacific/Kiritimati' });
    const res = await http().get('/api/scores?v=2').set(auth(A));
    expect(res.body.data.today).toBe(localDateKey('Pacific/Kiritimati'));
    await http().put('/api/preferences').set(auth(A)).send({ timezone: 'UTC' });
  });

  it('R6 §2.6 stale device / failed load posting zeros cannot clobber the score', async () => {
    const date = '2026-09-12';
    const supp = (await http().post('/api/supplements').set(auth(A)).send({ item: 'Zn' }))
      .body.data;
    await http()
      .post(`/api/supplements/${supp.id}/log`)
      .set(auth(A))
      .send({ date, isTaken: true });
    const before = await prisma.dailyScore.findUniqueOrThrow({
      where: { userId_date: { userId, date } },
    });
    await http().post('/api/scores').set(auth(B)).send({
      date,
      score: 0,
      suppDone: 0,
      tasksDone: 0,
      workoutDone: false,
      protein: 0,
    });
    const after = await prisma.dailyScore.findUniqueOrThrow({
      where: { userId_date: { userId, date } },
    });
    expect(after.suppDone).toBe(1);
    expect(after.score).toBe(before.score);
  });

  it('R7 §2.7 B saving sleep does not erase A’s bodyweight', async () => {
    const date = '2026-09-13';
    await http().post('/api/logs').set(auth(A)).send({ date, bw: '81.2' });
    await http().post('/api/logs').set(auth(B)).send({ date, sleep: '7.5' });
    const row = await prisma.dailyLog.findFirstOrThrow({ where: { userId, date } });
    expect([row.bw, row.sleep]).toEqual(['81.2', '7.5']);
  });

  it('R8 §2.8 toggling a supplement deleted on the other device is a clean 404', async () => {
    const supp = (
      await http().post('/api/supplements').set(auth(A)).send({ item: 'Gone' })
    ).body.data;
    await http().delete(`/api/supplements/${supp.id}`).set(auth(A));
    const res = await http()
      .post(`/api/supplements/${supp.id}/log`)
      .set(auth(B))
      .send({ date: '2026-09-14', isTaken: true });
    expect(res.status).toBe(404);
  });

  it('R9 §2.9 import on one device keeps ids, so the other device keeps working', async () => {
    const exp = (await http().get('/api/sync/export').set(auth(A))).body.data;
    const imp = await http().post('/api/sync/import').set(auth(A)).send(exp);
    expect(imp.status).toBe(200);
    for (const [oldId, newId] of Object.entries(imp.body.data.idMappings)) {
      expect(newId).toBe(oldId);
    }
    const toggle = await http()
      .post('/api/schedule/completions')
      .set(auth(B))
      .send({ blockId: exp.schedule[0].id, date: '2026-09-15', isComplete: true });
    expect(toggle.status).toBe(200);
  });

  it('R10 §2.11 another account cannot toggle my block / supplement / meal', async () => {
    const meal = (
      await http()
        .post('/api/meals/templates')
        .set(auth(A))
        .send({ dayOfWeek: 'Monday', name: 'Mine' })
    ).body.data;
    const supp = (
      await http().post('/api/supplements').set(auth(A)).send({ item: 'Mine' })
    ).body.data;
    const block = (await prisma.scheduleBlock.findFirstOrThrow({ where: { userId } })).id;
    const Y = await registerUser();
    const date = '2026-09-16';
    const r1 = await http()
      .post('/api/schedule/completions')
      .set(auth(Y))
      .send({ blockId: block, date, isComplete: true });
    const r2 = await http()
      .post(`/api/supplements/${supp.id}/log`)
      .set(auth(Y))
      .send({ date, isTaken: true });
    const r3 = await http()
      .post(`/api/meals/${meal.id}/log`)
      .set(auth(Y))
      .send({ date, isEaten: true });
    expect([r1.status, r2.status, r3.status]).toEqual([404, 404, 404]);
    const yId = (await http().get('/api/auth/me').set(auth(Y))).body.data.user.id;
    expect(await prisma.completion.count({ where: { userId: yId } })).toBe(0);
    expect(await prisma.supplementLog.count({ where: { userId: yId } })).toBe(0);
    expect(await prisma.mealLog.count({ where: { userId: yId } })).toBe(0);
  });

  it('R11 §1 row 23 concurrent starter seeds create the data once', async () => {
    const fresh = await registerUser();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        http().post('/api/sync/seed-starter').set(auth(fresh))
      )
    );
    expect(results.filter((r) => r.body.data?.seeded === true)).toHaveLength(1);
    const id = (await http().get('/api/auth/me').set(auth(fresh))).body.data.user.id;
    expect(await prisma.scheduleBlock.count({ where: { userId: id } })).toBe(7);
    expect(await prisma.mealTemplate.count({ where: { userId: id } })).toBe(28);
  });

  it('R12 §3.7 export carries meal grams/foodId so macros survive a reload', async () => {
    await http()
      .post('/api/meals/templates')
      .set(auth(A))
      .send({ dayOfWeek: 'Friday', name: 'Rice', grams: 150, foodId: 'food-rice' });
    const exp = (await http().get('/api/sync/export').set(auth(A))).body.data;
    const rice = exp.mealTemplatesByDay.Friday.find(
      (m: { name: string }) => m.name === 'Rice'
    );
    expect(rice).toMatchObject({ grams: 150, foodId: 'food-rice' });
  });
});
