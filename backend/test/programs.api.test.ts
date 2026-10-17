import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { auth, http, registerUser } from './helpers.js';

let H: Record<string, string>;
let id: string;

const program = {
  name: 'Upper/Lower',
  goal: 'strength',
  days: [
    { name: 'Upper', exercises: [{ exerciseName: 'Bench Press', sets: '3', reps: '5' }] },
    { name: 'Lower', exercises: [{ exerciseName: 'Squat', sets: '3', reps: '5' }] },
  ],
};

beforeAll(async () => {
  H = auth(await registerUser());
});

describe('/api/programs', () => {
  it('POST / creates; rejects an unknown goal', async () => {
    const res = await http().post('/api/programs').set(H).send(program);
    expect(res.status).toBe(201);
    expect(res.body.data.days).toHaveLength(2);
    id = res.body.data.id;
    expect(
      (
        await http()
          .post('/api/programs')
          .set(H)
          .send(Object.assign({}, program, { goal: 'yolo' }))
      ).status
    ).toBe(400);
  });

  it('GET / lists own + system programs; 401 without a token', async () => {
    const res = await http().get('/api/programs').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toContain(id);
    expect((await http().get('/api/programs')).status).toBe(401);
  });

  it('GET /:id reads one; 404 for an unknown id', async () => {
    expect((await http().get(`/api/programs/${id}`).set(H)).status).toBe(200);
    expect(
      (await http().get('/api/programs/00000000-0000-0000-0000-000000000000').set(H))
        .status
    ).toBe(404);
  });

  it('PUT /:id replaces days; rejects zero days', async () => {
    const res = await http()
      .put(`/api/programs/${id}`)
      .set(H)
      .send(Object.assign({}, program, { days: [program.days[0]] }));
    expect(res.status).toBe(200);
    expect(res.body.data.days).toHaveLength(1);
    expect(
      (
        await http()
          .put(`/api/programs/${id}`)
          .set(H)
          .send(Object.assign({}, program, { days: [] }))
      ).status
    ).toBe(400);
  });

  it('DELETE /:id removes; a second delete is 404', async () => {
    expect((await http().delete(`/api/programs/${id}`).set(H)).status).toBe(200);
    expect((await http().delete(`/api/programs/${id}`).set(H)).status).toBe(404);
  });

  it('deleting the account cascades to its custom programs (GymProgram.userId FK)', async () => {
    const owner = await registerUser();
    const created = await http().post('/api/programs').set(auth(owner)).send(program);
    expect(created.status).toBe(201);
    const pid = created.body.data.id;
    const me = await http().get('/api/auth/me').set(auth(owner));
    await prisma.user.delete({ where: { id: me.body.data.user.id } });
    expect(await prisma.gymProgram.findUnique({ where: { id: pid } })).toBeNull();
    expect(await prisma.programDay.count({ where: { programId: pid } })).toBe(0);
  });
});
