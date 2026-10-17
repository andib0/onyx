import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/scores', () => {
  it('POST / upserts one row per day; rejects a missing score', async () => {
    const first = await http()
      .post('/api/scores')
      .set(H)
      .send({ date: today, score: 40.4, tasksDone: 2, tasksTotal: 5, protein: 90.6 });
    expect(first.status).toBe(200);
    expect(first.body.data.score).toBe(40);
    expect(first.body.data.protein).toBe(91);
    const second = await http()
      .post('/api/scores')
      .set(H)
      .send({ date: today, score: 75, workoutDone: true });
    expect(second.body.data.id).toBe(first.body.data.id);
    expect((await http().post('/api/scores').set(H).send({ date: today })).status).toBe(
      400
    );
  });

  it('GET / returns recent days; 401 without a token', async () => {
    const res = await http().get('/api/scores?days=7').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].score).toBe(75);
    expect((await http().get('/api/scores')).status).toBe(401);
  });
});
