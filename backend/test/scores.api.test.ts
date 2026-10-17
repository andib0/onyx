import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  H = auth(await registerUser());
  await http().put('/api/preferences').set(H).send({ timezone: 'UTC' });
});

describe('/api/scores', () => {
  // Bet 5: the server computes the day's score; the legacy client payload is
  // validated but never stored (a stale device must not overwrite it).
  it('POST / returns the server-computed row, one per day; rejects a missing score', async () => {
    const block = await http()
      .post('/api/schedule')
      .set(H)
      .send({ start: '07:00', end: '07:15', title: 'Wake' });
    await http()
      .post('/api/schedule/completions')
      .set(H)
      .send({ blockId: block.body.data.id, date: today, isComplete: true });
    const first = await http()
      .post('/api/scores')
      .set(H)
      .send({ date: today, score: 40.4, tasksDone: 2, tasksTotal: 5, protein: 90.6 });
    expect(first.status).toBe(200);
    expect(first.body.data.score).toBe(100); // routine: 1 of 1 ticked
    expect(first.body.data.tasksDone).toBe(1);
    expect(first.body.data.protein).toBe(0); // nothing eaten, client value ignored
    const second = await http()
      .post('/api/scores')
      .set(H)
      .send({ date: today, score: 0, workoutDone: true });
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.score).toBe(100);
    expect(second.body.data.workoutDone).toBe(false);
    expect((await http().post('/api/scores').set(H).send({ date: today })).status).toBe(
      400
    );
  });

  it('GET / returns recent days; 401 without a token', async () => {
    const res = await http().get('/api/scores?days=7').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].score).toBe(100);
    expect(res.body.data[0]).toHaveProperty('outcomeScore');
    expect((await http().get('/api/scores')).status).toBe(401);
  });
});
