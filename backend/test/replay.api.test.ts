// A write replayed after a server wipe (the app's journal, contract §5) must
// recreate the row exactly: toggle rows get an id derived from their natural
// key, and toggle/set timestamps come from the write's HLC (the tap), not from
// the moment the request happened to arrive.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { toggleRowId } from '../src/services/sync/toggle.js';
import { formatHlc } from '../src/utils/hlc.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';

let u: TestUser;
let userId: string;
const DATE = '2026-10-17';
const TAP = Date.parse('2026-10-17T07:42:13.250Z');
const hlc = formatHlc(TAP, 3, 'phone');

beforeAll(async () => {
  u = await registerUser();
  userId = (await http().get('/api/auth/me').set(auth(u))).body.data.user.id;
});

describe('replays recreate identical rows', () => {
  it('toggle: id from the natural key, completedAt from the HLC', async () => {
    const block = randomUUID();
    await http()
      .post('/api/schedule')
      .set(auth(u))
      .send({ id: block, start: '07:00', end: '07:30', title: 'T' });
    const send = () =>
      http()
        .post('/api/schedule/completions')
        .set(auth(u))
        .send({ blockId: block, date: DATE, isComplete: true, hlc });
    const first = (await send()).body.data;
    expect(first.id).toBe(toggleRowId('completion', userId, block, DATE));
    expect(new Date(first.completedAt).getTime()).toBe(TAP);

    await prisma.completion.deleteMany({ where: { blockId: block } }); // wiped
    const replay = (await send()).body.data;
    expect(replay).toEqual(first);
  });

  it('set: createdAt from the HLC', async () => {
    const session = randomUUID();
    await http()
      .post('/api/workouts/sessions')
      .set(auth(u))
      .send({ id: session, date: DATE });
    const res = await http()
      .post(`/api/workouts/sessions/${session}/sets`)
      .set(auth(u))
      .send({
        id: randomUUID(),
        exerciseName: 'Squat',
        setNumber: 1,
        weightKg: 1,
        reps: 1,
        hlc,
      });
    expect(new Date(res.body.data.createdAt).getTime()).toBe(TAP);
  });

  it('toggle row ids differ per kind, target and date (UUID-shaped)', () => {
    const a = toggleRowId('meal', userId, 't1', DATE);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(toggleRowId('meal', userId, 't1', '2026-10-18')).not.toBe(a);
    expect(toggleRowId('supplement', userId, 't1', DATE)).not.toBe(a);
  });
});
