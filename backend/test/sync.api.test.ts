import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

/**
 * Status-level checks only: sync semantics are being reworked separately
 * (Bet 2); these pin auth, validation and the happy path of each route.
 */

let H: Record<string, string>;

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/sync', () => {
  it('POST /seed-starter seeds a new account; 401 without a token', async () => {
    const res = await http().post('/api/sync/seed-starter').set(H).send({});
    expect(res.status).toBe(200);
    expect((await http().post('/api/sync/seed-starter').send({})).status).toBe(401);
  });

  it('POST /import accepts a state; rejects a wrongly typed one', async () => {
    const res = await http()
      .post('/api/sync/import')
      .set(H)
      .send({
        schedule: [{ start: '07:00', end: '07:30', title: 'Walk' }],
        supplementsList: [{ item: 'Creatine' }],
        log: [{ date: '2026-10-17', bw: '80' }],
      });
    expect(res.status).toBe(200);
    expect(
      (await http().post('/api/sync/import').set(H).send({ schedule: 'nope' })).status
    ).toBe(400);
  });

  it('GET /export returns the state; 401 without a token', async () => {
    const res = await http().get('/api/sync/export').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data.schedule.length).toBeGreaterThanOrEqual(1);
    expect((await http().get('/api/sync/export')).status).toBe(401);
  });

  it('GET /state returns the full state; 401 with a bad token', async () => {
    expect((await http().get('/api/sync/state').set(H)).status).toBe(200);
    expect(
      (await http().get('/api/sync/state').set({ Authorization: 'Bearer nope' })).status
    ).toBe(401);
  });
});
