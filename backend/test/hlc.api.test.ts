// Bet 2: HLC last-writer-wins for toggles, sets and daily-log fields.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { formatHlc } from '../src/utils/hlc.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';

let u: TestUser;
let blockId: string;
let suppId: string;
let mealId: string;
const T0 = Date.parse('2026-10-17T08:00:00Z');
const h = (offsetMs: number, device = 'A', counter = 0) =>
  formatHlc(T0 + offsetMs, counter, device);

beforeAll(async () => {
  u = await registerUser();
  blockId = (
    await http()
      .post('/api/schedule')
      .set(auth(u))
      .send({ start: '07:00', end: '07:15', title: 'B' })
  ).body.data.id;
  suppId = (await http().post('/api/supplements').set(auth(u)).send({ item: 'S' })).body
    .data.id;
  mealId = (
    await http()
      .post('/api/meals/templates')
      .set(auth(u))
      .send({ dayOfWeek: 'Saturday', name: 'M' })
  ).body.data.id;
});

const toggles = () => [
  {
    name: 'completion',
    send: (date: string, v: boolean, hlc?: string) =>
      http()
        .post('/api/schedule/completions')
        .set(auth(u))
        .send({ blockId, date, isComplete: v, hlc }),
    read: async (date: string) =>
      (await prisma.completion.findFirst({ where: { blockId, date } }))?.isComplete,
  },
  {
    name: 'supplement log',
    send: (date: string, v: boolean, hlc?: string) =>
      http()
        .post(`/api/supplements/${suppId}/log`)
        .set(auth(u))
        .send({ date, isTaken: v, hlc }),
    read: async (date: string) =>
      (await prisma.supplementLog.findFirst({ where: { supplementId: suppId, date } }))
        ?.isTaken,
  },
  {
    name: 'meal log',
    send: (date: string, v: boolean, hlc?: string) =>
      http()
        .post(`/api/meals/${mealId}/log`)
        .set(auth(u))
        .send({ date, isEaten: v, hlc }),
    read: async (date: string) =>
      (await prisma.mealLog.findFirst({ where: { mealTemplateId: mealId, date } }))
        ?.isEaten,
  },
];

describe('toggles: the greatest hlc wins regardless of arrival order', () => {
  for (const t of toggles()) {
    it(`${t.name}: newer OFF then stale ON → stays OFF`, async () => {
      const date = '2026-09-01';
      const off = await t.send(date, false, h(2000));
      expect(off.status).toBe(200);
      expect(off.body.data.applied).toBe(true);
      const staleOn = await t.send(date, true, h(1000));
      expect(staleOn.status).toBe(200);
      expect(staleOn.body.data.applied).toBe(false);
      expect(staleOn.body.data.hlc).toBe(h(2000));
      expect(await t.read(date)).toBe(false);
    });

    it(`${t.name}: ties on time break by counter, then device id`, async () => {
      const date = '2026-09-02';
      await t.send(date, true, h(0, 'B', 1));
      await t.send(date, false, h(0, 'A', 1)); // A < B → loses
      expect(await t.read(date)).toBe(true);
      await t.send(date, false, h(0, 'A', 2)); // higher counter wins
      expect(await t.read(date)).toBe(false);
    });

    it(`${t.name}: writes without hlc still apply (legacy client)`, async () => {
      const date = '2026-09-03';
      await t.send(date, true, h(5000));
      const legacy = await t.send(date, false);
      expect(legacy.body.data.applied).toBe(true);
      expect(await t.read(date)).toBe(false);
    });
  }

  it('rejects malformed and far-future hlc', async () => {
    const t = toggles()[0];
    expect((await t.send('2026-09-04', true, 'yesterday')).status).toBe(400);
    const future = formatHlc(Date.now() + 3 * 86_400_000, 0, 'A');
    expect((await t.send('2026-09-04', true, future)).status).toBe(400);
  });
});

describe('workout sets: hlc last-writer-wins per (session, exercise, set)', () => {
  it('a stale retry does not overwrite a newer edit', async () => {
    const sid = randomUUID();
    await http()
      .post('/api/workouts/sessions')
      .set(auth(u))
      .send({ id: sid, date: '2026-10-17' });
    const path = `/api/workouts/sessions/${sid}/sets`;
    const base = { exerciseName: 'Squat', setNumber: 1 };
    await http()
      .post(path)
      .set(auth(u))
      .send(Object.assign({ weightKg: 100, reps: 5, hlc: h(2000) }, base));
    const stale = await http()
      .post(path)
      .set(auth(u))
      .send(Object.assign({ weightKg: 90, reps: 5, hlc: h(1000) }, base));
    expect(stale.status).toBe(200);
    expect(Number(stale.body.data.weightKg)).toBe(100);
  });
});

describe('daily log: field-level PATCH with per-field clocks', () => {
  it('B saving sleep does not wipe A’s bodyweight (audit 02 §2.7)', async () => {
    const date = '2026-10-10';
    await http().post('/api/logs').set(auth(u)).send({ date, bw: '81.2' });
    await http().post('/api/logs').set(auth(u)).send({ date, sleep: '7.5' });
    const row = await prisma.dailyLog.findFirstOrThrow({
      where: { date, user: { email: u.email } },
    });
    expect(row.bw).toBe('81.2');
    expect(row.sleep).toBe('7.5');
  });

  it('PATCH applies each field only if its hlc is newer', async () => {
    const date = '2026-10-11';
    const p = (body: object) => http().patch(`/api/logs/${date}`).set(auth(u)).send(body);
    const first = await p({ bw: '80.0', sleep: '7', hlc: h(1000, 'A') });
    expect(first.status).toBe(201);
    const second = await p({ sleep: '8', hlc: h(3000, 'B') });
    expect(second.status).toBe(200);
    // A's delayed write: bw is newer than A's own earlier bw, sleep is older than B's.
    const late = await p({ bw: '79.5', sleep: '6', hlc: h(2000, 'A') });
    expect(late.body.data.appliedFields).toEqual(['bw']);
    expect(late.body.data.staleFields).toEqual(['sleep']);
    const row = late.body.data;
    expect([row.bw, row.sleep]).toEqual(['79.5', '8']);
    expect(row.fieldClock).toEqual({ bw: h(2000, 'A'), sleep: h(3000, 'B') });
  });

  it('rejects impossible dates', async () => {
    const res = await http()
      .patch('/api/logs/2026-02-31')
      .set(auth(u))
      .send({ bw: '80' });
    expect(res.status).toBe(400);
  });
});
