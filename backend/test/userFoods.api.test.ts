import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
let foodId: string;
let id: string;

beforeAll(async () => {
  H = auth(await registerUser());
  foodId = (await prisma.food.create({ data: { name: `Oats ${Date.now()}` } })).id;
});

describe('/api/user-foods', () => {
  it('POST / saves a food (idempotent); rejects a missing foodId', async () => {
    const res = await http().post('/api/user-foods').set(H).send({ foodId });
    expect(res.status).toBe(200);
    id = res.body.data.id;
    const again = await http().post('/api/user-foods').set(H).send({ foodId });
    expect(again.body.data.id).toBe(id);
    expect((await http().post('/api/user-foods').set(H).send({})).status).toBe(400);
  });

  it('GET / lists saved foods with the food row; 401 without a token', async () => {
    const res = await http().get('/api/user-foods').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data[0].food.id).toBe(foodId);
    expect((await http().get('/api/user-foods')).status).toBe(401);
  });

  it('DELETE /:id removes; a second delete is 404', async () => {
    expect((await http().delete(`/api/user-foods/${id}`).set(H)).status).toBe(200);
    expect((await http().delete(`/api/user-foods/${id}`).set(H)).status).toBe(404);
  });
});
