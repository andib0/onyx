import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
let id: string;

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/supplements', () => {
  it('POST / creates; rejects a missing item and a bad time', async () => {
    const res = await http()
      .post('/api/supplements')
      .set(H)
      .send({ item: 'Creatine', dose: '5 g', timeAt: '08:00' });
    expect(res.status).toBe(201);
    id = res.body.data.id;
    expect((await http().post('/api/supplements').set(H).send({})).status).toBe(400);
    expect(
      (await http().post('/api/supplements').set(H).send({ item: 'x', timeAt: '8' }))
        .status
    ).toBe(400);
  });

  it('GET / lists; 401 without a token', async () => {
    const res = await http().get('/api/supplements').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect((await http().get('/api/supplements')).status).toBe(401);
  });

  it('PUT /:id updates; rejects a bad time', async () => {
    const res = await http().put(`/api/supplements/${id}`).set(H).send({ dose: '3 g' });
    expect(res.status).toBe(200);
    expect(res.body.data.dose).toBe('3 g');
    expect(
      (await http().put(`/api/supplements/${id}`).set(H).send({ timeAt: '25:00' })).status
    ).toBe(400);
  });

  it('POST /:id/log toggles; GET /logs reads; validation failures', async () => {
    const log = await http()
      .post(`/api/supplements/${id}/log`)
      .set(H)
      .send({ date: '2026-10-17', isTaken: true });
    expect(log.status).toBe(200);
    expect(log.body.data.isTaken).toBe(true);
    const logs = await http()
      .get('/api/supplements/logs?startDate=2026-10-01&endDate=2026-10-31')
      .set(H);
    expect(logs.status).toBe(200);
    expect(logs.body.data).toHaveLength(1);
    expect(
      (
        await http()
          .post(`/api/supplements/${id}/log`)
          .set(H)
          .send({ date: '2026-10-17' })
      ).status
    ).toBe(400);
    expect(
      (await http().get('/api/supplements/logs?startDate=yesterday').set(H)).status
    ).toBe(400);
  });

  it('DELETE /:id removes; a second delete is 404', async () => {
    expect((await http().delete(`/api/supplements/${id}`).set(H)).status).toBe(200);
    expect((await http().delete(`/api/supplements/${id}`).set(H)).status).toBe(404);
  });
});
