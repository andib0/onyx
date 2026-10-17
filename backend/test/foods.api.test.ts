import { beforeAll, describe, expect, it } from 'vitest';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
let id: string;
const name = `Skyr ${Date.now()}`;

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/foods', () => {
  it('POST / creates a food; rejects negative macros', async () => {
    const res = await http()
      .post('/api/foods')
      .set(H)
      .send({ name, proteinPer100g: 11, caloriesPer100g: 63, sugarPer100g: 4 });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.sugarPer100g)).toBe(4);
    id = res.body.data.id;
    expect(
      (await http().post('/api/foods').set(H).send({ name: 'x', proteinPer100g: -1 }))
        .status
    ).toBe(400);
  });

  it('GET / searches by name; 401 without a token', async () => {
    const res = await http()
      .get(`/api/foods?search=${encodeURIComponent(name)}&limit=5`)
      .set(H);
    expect(res.status).toBe(200);
    expect(res.body.data[0].id).toBe(id);
    expect((await http().get('/api/foods?search=sk')).status).toBe(401);
  });

  it('GET /:id reads one; 404 for an unknown id', async () => {
    expect((await http().get(`/api/foods/${id}`).set(H)).status).toBe(200);
    expect(
      (await http().get('/api/foods/00000000-0000-0000-0000-000000000000').set(H)).status
    ).toBe(404);
  });
});
