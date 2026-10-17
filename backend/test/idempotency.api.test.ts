// Bet 2: every create of a user-owned row accepts a client UUID; replaying the
// same request returns the same row and never inserts a duplicate.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';

let u: TestUser;
let userId: string;

beforeAll(async () => {
  u = await registerUser();
  userId = (await http().get('/api/auth/me').set(auth(u))).body.data.user.id;
});

async function twice(method: 'post' | 'put', path: string, body: object) {
  const a = await http()[method](path).set(auth(u)).send(body);
  const b = await http()[method](path).set(auth(u)).send(body);
  return [a, b] as const;
}

describe('idempotent creates (same client id twice → one row)', () => {
  it('schedule block', async () => {
    const id = randomUUID();
    const [a, b] = await twice('post', '/api/schedule', {
      id,
      start: '07:00',
      end: '07:15',
      title: 'Wake',
    });
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(a.body.data.id).toBe(id);
    expect(b.body.data.id).toBe(id);
    expect(await prisma.scheduleBlock.count({ where: { userId, title: 'Wake' } })).toBe(
      1
    );
  });

  it('supplement', async () => {
    const id = randomUUID();
    const [a, b] = await twice('post', '/api/supplements', { id, item: 'Creatine' });
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(await prisma.supplement.count({ where: { id } })).toBe(1);
  });

  it('meal template (with tags, grams and foodId)', async () => {
    const id = randomUUID();
    const [a, b] = await twice('post', '/api/meals/templates', {
      id,
      dayOfWeek: 'Monday',
      name: 'Lunch',
      grams: 200,
      foodId: 'food-x',
      tags: [{ label: 'Protein', value: '30' }],
    });
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(b.body.data.tags).toHaveLength(1);
    expect(await prisma.mealTemplateTag.count({ where: { mealTemplateId: id } })).toBe(1);
  });

  it('program with day and exercise ids', async () => {
    const id = randomUUID();
    const dayId = randomUUID();
    const exId = randomUUID();
    const [a, b] = await twice('post', '/api/programs', {
      id,
      name: 'Mine',
      goal: 'strength',
      days: [
        {
          id: dayId,
          name: 'A',
          weekdays: [1, 4],
          exercises: [{ id: exId, exerciseName: 'Squat', sets: '3', reps: '5' }],
        },
      ],
    });
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(b.body.data.days[0].id).toBe(dayId);
    expect(b.body.data.days[0].weekdays).toEqual([1, 4]);
    expect(b.body.data.days[0].exercises[0].id).toBe(exId);
    expect(await prisma.programDay.count({ where: { programId: id } })).toBe(1);
  });

  it('workout session and sets (set dedupe also without an id)', async () => {
    const sid = randomUUID();
    const [a, b] = await twice('post', '/api/workouts/sessions', {
      id: sid,
      date: '2026-10-01',
      programDayName: 'A',
      startedAt: '2026-10-01T17:00:00.000Z',
    });
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(b.body.data.startedAt).toBe('2026-10-01T17:00:00.000Z');

    const setId = randomUUID();
    const set = { id: setId, exerciseName: 'Bench', setNumber: 1, weightKg: 80, reps: 5 };
    const [s1, s2] = await twice('post', `/api/workouts/sessions/${sid}/sets`, set);
    expect([s1.status, s2.status]).toEqual([201, 200]);
    expect(s2.body.data.id).toBe(setId);

    // Legacy client (no id): same set number again updates, never duplicates.
    const legacy = { exerciseName: 'Bench', setNumber: 2, weightKg: 80, reps: 5 };
    await twice('post', `/api/workouts/sessions/${sid}/sets`, legacy);
    await http()
      .post(`/api/workouts/sessions/${sid}/sets`)
      .set(auth(u))
      .send(Object.assign({}, legacy, { reps: 6 }));
    const rows = await prisma.workoutSetLog.findMany({
      where: { sessionId: sid },
      orderBy: { setNumber: 'asc' },
    });
    expect(rows.map((r) => [r.setNumber, r.reps])).toEqual([
      [1, 5],
      [2, 6],
    ]);
  });

  it('daily log, user food, toggles: replays keep one row', async () => {
    const logId = randomUUID();
    await twice('post', '/api/logs', { id: logId, date: '2026-10-02', bw: '80.1' });
    expect(await prisma.dailyLog.count({ where: { userId, date: '2026-10-02' } })).toBe(
      1
    );
    expect(
      (await prisma.dailyLog.findFirst({ where: { userId, date: '2026-10-02' } }))?.id
    ).toBe(logId);

    const food = await prisma.food.create({ data: { name: 'Idem food' } });
    const ufId = randomUUID();
    const [f1, f2] = await twice('post', '/api/user-foods', {
      id: ufId,
      foodId: food.id,
    });
    expect(f1.body.data.id).toBe(ufId);
    expect(f2.body.data.id).toBe(ufId);

    const block = await prisma.scheduleBlock.findFirstOrThrow({ where: { userId } });
    const cid = randomUUID();
    const [c1, c2] = await twice('post', '/api/schedule/completions', {
      id: cid,
      blockId: block.id,
      date: '2026-10-02',
      isComplete: true,
    });
    expect(c1.body.data.id).toBe(cid);
    expect(c2.body.data.id).toBe(cid);
  });

  it('an id owned by another user is a 409, never a takeover', async () => {
    const other = await registerUser();
    const id = randomUUID();
    await http()
      .post('/api/schedule')
      .set(auth(u))
      .send({ id, start: '08:00', end: '08:30', title: 'Mine' });
    const res = await http()
      .post('/api/schedule')
      .set(auth(other))
      .send({ id, start: '08:00', end: '08:30', title: 'Theirs' });
    expect(res.status).toBe(409);
    expect((await prisma.scheduleBlock.findUnique({ where: { id } }))?.title).toBe(
      'Mine'
    );
  });

  it('rejects non-UUID client ids', async () => {
    const res = await http()
      .post('/api/schedule')
      .set(auth(u))
      .send({ id: 'not-a-uuid', start: '08:00', end: '08:30', title: 'X' });
    expect(res.status).toBe(400);
  });
});
