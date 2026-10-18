// "Mark done" (trained but didn't log) counts for the server Outcome Score T
// component (contracts/README.md): a session finished with `markedDone: true`
// — or, from clients before the flag, a finished session with no sets — counts
// as the planned sets.
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { auth, http, registerUser, type TestUser } from './helpers.js';

const DATE = '2026-10-17'; // Saturday, ISO weekday 6
let u: TestUser;

async function setup() {
  u = await registerUser();
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
          exercises: [{ exerciseName: 'Squat', sets: '5', reps: '5' }],
        },
      ],
    });
  await http().put('/api/preferences').set(auth(u)).send({
    selectedProgramId: programId,
    proteinTargetG: 160,
    calorieTargetKcal: 2500,
  });
  const meal = await http()
    .post('/api/meals/templates')
    .set(auth(u))
    .send({
      dayOfWeek: 'Saturday',
      name: 'Big meal',
      grams: 100,
      tags: [
        { label: 'Protein', value: '160' },
        { label: 'Calories', value: '2500' },
      ],
    });
  await http()
    .post(`/api/meals/${meal.body.data.id}/log`)
    .set(auth(u))
    .send({ date: DATE, isEaten: true });
}

const today = async () =>
  (await http().get(`/api/today?date=${DATE}`).set(auth(u))).body.data.score.today;

const start = async () => {
  const id = randomUUID();
  await http().post('/api/workouts/sessions').set(auth(u)).send({ id, date: DATE });
  return id;
};
const logSets = async (id: string, n: number) => {
  for (let i = 1; i <= n; i++)
    await http()
      .post(`/api/workouts/sessions/${id}/sets`)
      .set(auth(u))
      .send({ exerciseName: 'Squat', setNumber: i, weightKg: 100, reps: 5 });
};

describe('Mark done counts as the planned sets', () => {
  beforeEach(setup);

  it('finished with markedDone and no sets → T = 1, kept', async () => {
    const id = await start();
    const res = await http()
      .patch(`/api/workouts/sessions/${id}/finish`)
      .set(auth(u))
      .send({ durationSeconds: 0, markedDone: true });
    expect(res.status).toBe(200);
    expect(res.body.data.markedDone).toBe(true);
    const s = await today();
    expect(s.components.T).toBe(1);
    expect(s.kept).toBe(true);
    expect(s.outcomeScore).toBe(100);
  });

  it('mark done after 2 of 5 sets → T = 1 (without the flag it would be 0.5)', async () => {
    const id = await start();
    await logSets(id, 2);
    await http()
      .patch(`/api/workouts/sessions/${id}/finish`)
      .set(auth(u))
      .send({ durationSeconds: 600 });
    expect((await today()).components.T).toBe(0.5);
    await http()
      .patch(`/api/workouts/sessions/${id}/finish`)
      .set(auth(u))
      .send({ markedDone: true });
    expect((await today()).components.T).toBe(1);
  });

  it('legacy client: a finished session without sets counts too', async () => {
    const id = await start();
    expect((await today()).components.T).toBe(0); // open, nothing logged
    await http()
      .patch(`/api/workouts/sessions/${id}/finish`)
      .set(auth(u))
      .send({ durationSeconds: 0 });
    expect((await today()).components.T).toBe(1);
  });

  it('rejects a non-boolean markedDone', async () => {
    const id = await start();
    const res = await http()
      .patch(`/api/workouts/sessions/${id}/finish`)
      .set(auth(u))
      .send({ markedDone: 'yes' });
    expect(res.status).toBe(400);
  });
});
