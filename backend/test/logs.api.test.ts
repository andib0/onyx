import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
let id: string;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/logs', () => {
  it('POST / upserts by date; rejects a missing date', async () => {
    const res = await http()
      .post('/api/logs')
      .set(H)
      .send({ date: today, bw: '80.5', sleep: '7.5', steps: '9000' });
    expect(res.status).toBe(201);
    id = res.body.data.id;
    const again = await http().post('/api/logs').set(H).send({ date: today, bw: '80.1' });
    expect(again.body.data.id).toBe(id);
    expect((await http().post('/api/logs').set(H).send({ bw: '80' })).status).toBe(400);
  });

  it('GET / lists with a date range; 401 without a token', async () => {
    const res = await http().get(`/api/logs?startDate=${today}&endDate=${today}`).set(H);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect((await http().get('/api/logs')).status).toBe(401);
  });

  it('GET /stats summarises; rejects days=0', async () => {
    const res = await http().get('/api/logs/stats?days=30').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data.weight.current).toBeCloseTo(80.1);
    expect((await http().get('/api/logs/stats?days=0').set(H)).status).toBe(400);
  });

  it('GET /:date reads one day; 404 for a day without a log', async () => {
    expect((await http().get(`/api/logs/${today}`).set(H)).status).toBe(200);
    expect((await http().get('/api/logs/2001-01-01').set(H)).status).toBe(404);
  });

  it('DELETE /:id removes; a second delete is 404', async () => {
    expect((await http().delete(`/api/logs/${id}`).set(H)).status).toBe(200);
    expect((await http().delete(`/api/logs/${id}`).set(H)).status).toBe(404);
  });
});
