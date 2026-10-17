import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
let blockId: string;

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/schedule', () => {
  it('POST / creates a block; rejects a bad time', async () => {
    const res = await http()
      .post('/api/schedule')
      .set(H)
      .send({ start: '07:00', end: '07:30', title: 'Walk' });
    expect(res.status).toBe(201);
    blockId = res.body.data.id;
    const bad = await http()
      .post('/api/schedule')
      .set(H)
      .send({ start: '7am', end: '07:30', title: 'Walk' });
    expect(bad.status).toBe(400);
  });

  it('GET / lists blocks; 401 without a token', async () => {
    const res = await http().get('/api/schedule').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data.map((b: { id: string }) => b.id)).toContain(blockId);
    expect((await http().get('/api/schedule')).status).toBe(401);
  });

  it('PUT /:id updates; rejects an empty title', async () => {
    const res = await http()
      .put(`/api/schedule/${blockId}`)
      .set(H)
      .send({ title: 'Run' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Run');
    expect(
      (await http().put(`/api/schedule/${blockId}`).set(H).send({ title: '' })).status
    ).toBe(400);
  });

  it('GET/POST /completions toggle and read; validation failures', async () => {
    const post = await http()
      .post('/api/schedule/completions')
      .set(H)
      .send({ blockId, date: '2026-10-17', isComplete: true });
    expect(post.status).toBe(200);
    expect(post.body.data.isComplete).toBe(true);
    const get = await http().get('/api/schedule/completions?date=2026-10-17').set(H);
    expect(get.status).toBe(200);
    expect(get.body.data).toHaveLength(1);
    expect((await http().get('/api/schedule/completions').set(H)).status).toBe(400);
    expect(
      (
        await http()
          .post('/api/schedule/completions')
          .set(H)
          .send({ blockId, date: '2026-10-17' })
      ).status
    ).toBe(400);
  });

  it('DELETE /:id removes; a second delete is 404', async () => {
    expect((await http().delete(`/api/schedule/${blockId}`).set(H)).status).toBe(200);
    expect((await http().delete(`/api/schedule/${blockId}`).set(H)).status).toBe(404);
  });
});
