import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
let sessionId: string;
let setId: string;

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/workouts', () => {
  it('POST /sessions starts a session; rejects a missing date', async () => {
    const res = await http()
      .post('/api/workouts/sessions')
      .set(H)
      .send({ date: '2026-10-17', programDayName: 'Upper' });
    expect(res.status).toBe(201);
    sessionId = res.body.data.id;
    expect((await http().post('/api/workouts/sessions').set(H).send({})).status).toBe(
      400
    );
  });

  it('POST /sessions/:id/sets logs a set; rejects setNumber 0', async () => {
    const res = await http()
      .post(`/api/workouts/sessions/${sessionId}/sets`)
      .set(H)
      .send({
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 80,
        reps: 5,
        rir: '2',
      });
    expect(res.status).toBe(201);
    setId = res.body.data.id;
    expect(
      (
        await http()
          .post(`/api/workouts/sessions/${sessionId}/sets`)
          .set(H)
          .send({ exerciseName: 'Bench Press', setNumber: 0 })
      ).status
    ).toBe(400);
  });

  it('PATCH /sessions/:id/finish ends it; rejects a negative duration', async () => {
    const res = await http()
      .patch(`/api/workouts/sessions/${sessionId}/finish`)
      .set(H)
      .send({ durationSeconds: 3600 });
    expect(res.status).toBe(200);
    expect(res.body.data.endedAt).toBeTruthy();
    expect(
      (
        await http()
          .patch(`/api/workouts/sessions/${sessionId}/finish`)
          .set(H)
          .send({ durationSeconds: -5 })
      ).status
    ).toBe(400);
  });

  it('GET /sessions lists with sets; rejects limit > 100', async () => {
    const res = await http().get('/api/workouts/sessions?limit=10').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data[0].sets).toHaveLength(1);
    expect((await http().get('/api/workouts/sessions?limit=101').set(H)).status).toBe(
      400
    );
  });

  it('GET /exercise-history returns last performance; 401 without a token', async () => {
    const res = await http()
      .get('/api/workouts/exercise-history?names=Bench%20Press|Squat')
      .set(H);
    expect(res.status).toBe(200);
    expect((await http().get('/api/workouts/exercise-history?names=Squat')).status).toBe(
      401
    );
  });

  it('GET /exercise-sessions groups sets by session; rejects limit=0', async () => {
    const res = await http()
      .get('/api/workouts/exercise-sessions?name=Bench%20Press')
      .set(H);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sets[0].weightKg).toBe(80);
    expect(
      (await http().get('/api/workouts/exercise-sessions?name=x&limit=0').set(H)).status
    ).toBe(400);
  });

  it('DELETE /sets/:id removes; a second delete is 404', async () => {
    expect((await http().delete(`/api/workouts/sets/${setId}`).set(H)).status).toBe(200);
    expect((await http().delete(`/api/workouts/sets/${setId}`).set(H)).status).toBe(404);
  });
});
