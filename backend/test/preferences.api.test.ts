import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/preferences', () => {
  it('GET / returns the defaults (timezone from registration); 401 without token', async () => {
    const res = await http().get('/api/preferences').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data.timezone).toBe('UTC');
    expect((await http().get('/api/preferences')).status).toBe(401);
  });

  it('PUT / updates allowed fields; rejects a bad sleep target', async () => {
    const res = await http()
      .put('/api/preferences')
      .set(H)
      .send({ sleepTarget: '22:45', proteinTarget: '160 g/day' });
    expect(res.status).toBe(200);
    expect(res.body.data.sleepTarget).toBe('22:45');
    expect(
      (await http().put('/api/preferences').set(H).send({ sleepTarget: 'late' })).status
    ).toBe(400);
  });

  it('PUT / can select a program the user can see, and clear it', async () => {
    const program = await http()
      .post('/api/programs')
      .set(H)
      .send({
        name: 'Mine',
        goal: 'general',
        days: [{ name: 'A', exercises: [{ exerciseName: 'Row', sets: '3', reps: '8' }] }],
      });
    const dayId = program.body.data.days[0].id;
    const set = await http()
      .put('/api/preferences')
      .set(H)
      .send({ selectedProgramId: program.body.data.id, selectedProgramDayId: dayId });
    expect(set.status).toBe(200);
    expect(set.body.data.selectedProgramDayId).toBe(dayId);
    const clear = await http()
      .put('/api/preferences')
      .set(H)
      .send({ selectedProgramId: null, selectedProgramDayId: null });
    expect(clear.status).toBe(200);
    expect(clear.body.data.selectedProgramId).toBeNull();
  });
});
