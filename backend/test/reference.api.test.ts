import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { auth, http, registerUser } from './helpers.js';

/** Read-only reference data: /supplement-db and /exercises. */

let H: Record<string, string>;
const tag = `T${Date.now()}`;

beforeAll(async () => {
  H = auth(await registerUser());
  await prisma.supplementDatabase.create({
    data: { name: `${tag} Magnesium`, category: 'Mineral' },
  });
  await prisma.exerciseLibrary.create({
    data: { name: `${tag} Hip Thrust`, primaryMuscle: 'Glutes' },
  });
});

describe('/api/supplement-db', () => {
  it('GET / searches; 401 without a token, 400 for limit > 200', async () => {
    const res = await http().get(`/api/supplement-db?search=${tag}`).set(H);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect((await http().get('/api/supplement-db')).status).toBe(401);
    expect((await http().get('/api/supplement-db?limit=201').set(H)).status).toBe(400);
  });
});

describe('/api/exercises', () => {
  it('GET / searches; 401 without a token, 400 for limit > 50', async () => {
    const res = await http().get(`/api/exercises?search=${tag}`).set(H);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect((await http().get('/api/exercises')).status).toBe(401);
    expect((await http().get('/api/exercises?limit=51').set(H)).status).toBe(400);
  });
});
