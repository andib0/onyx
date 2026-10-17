import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';

/** Input validation (audit F4/F10): Zod on bodies, queries and params. */

let u: TestUser;
let H: Record<string, string>;

beforeAll(async () => {
  u = await registerUser();
  H = auth(u);
});

describe('dates must be real calendar days', () => {
  it.each([
    ['POST /logs', () => http().post('/api/logs').set(H).send({ date: '2026-02-31' })],
    [
      'POST /scores',
      () => http().post('/api/scores').set(H).send({ date: '2026-02-30', score: 50 }),
    ],
    ['GET /logs/:date', () => http().get('/api/logs/2026-02-31').set(H)],
    [
      'GET /schedule/completions',
      () => http().get('/api/schedule/completions?date=2026-13-01').set(H),
    ],
    ['GET /meals/logs', () => http().get('/api/meals/logs?date=2025-02-29').set(H)],
    [
      'POST /workouts/sessions',
      () => http().post('/api/workouts/sessions').set(H).send({ date: '2026-04-31' }),
    ],
  ])('%s rejects an impossible date', async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts a leap day', async () => {
    const res = await http().post('/api/logs').set(H).send({ date: '2028-02-29' });
    expect(res.status).toBe(201);
  });
});

describe('query params are bounded', () => {
  it('/foods?limit is capped at 100', async () => {
    expect((await http().get('/api/foods?search=ch&limit=101').set(H)).status).toBe(400);
    expect((await http().get('/api/foods?search=ch&limit=100').set(H)).status).toBe(200);
    expect((await http().get('/api/foods?search=ch&limit=abc').set(H)).status).toBe(400);
    expect((await http().get('/api/foods?search=ch&limit=1&limit=2').set(H)).status).toBe(
      400
    );
  });

  it('/foods requires a 2+ char search', async () => {
    const res = await http().get('/api/foods').set(H);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2 characters/);
  });

  it('/scores?days and /logs?limit reject out-of-range values', async () => {
    expect((await http().get('/api/scores?days=366').set(H)).status).toBe(400);
    expect((await http().get('/api/logs?limit=0').set(H)).status).toBe(400);
  });
});

describe('preferences: field allowlist (audit F4)', () => {
  it('ignores relation writes and foreign keys smuggled in the body', async () => {
    const me = (await http().get('/api/auth/me').set(H)).body.data.user;
    const res = await http()
      .put('/api/preferences')
      .set(H)
      .send({
        timezone: 'Europe/Berlin',
        user: { update: { email: 'pwned@evil.test' } },
        userId: 'someone-else',
        id: 'x',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.timezone).toBe('Europe/Berlin');
    const row = await prisma.user.findUnique({ where: { id: me.id } });
    expect(row!.email).toBe(u.email);
    const prefs = await prisma.userPreferences.findUnique({ where: { userId: me.id } });
    expect(prefs!.userId).toBe(me.id);
  });

  it('rejects unknown timezones and malformed times', async () => {
    expect(
      (await http().put('/api/preferences').set(H).send({ timezone: 'Mars/Base' })).status
    ).toBe(400);
    expect(
      (await http().put('/api/preferences').set(H).send({ caffeineCutoff: '25:00' }))
        .status
    ).toBe(400);
    expect(
      (await http().put('/api/preferences').set(H).send({ caffeineCutoff: '9:30' }))
        .status
    ).toBe(200);
  });

  it('rejects a program id that does not exist', async () => {
    const res = await http()
      .put('/api/preferences')
      .set(H)
      .send({ selectedProgramId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });
});

describe('scores, user-foods, profile, foods bodies', () => {
  it('scores: score must be 0..100 and present', async () => {
    const post = (body: object) => http().post('/api/scores').set(H).send(body);
    expect((await post({ date: '2026-10-01', score: 150 })).status).toBe(400);
    expect((await post({ date: '2026-10-01' })).status).toBe(400);
    expect((await post({ date: '2026-10-01', score: 80, protein: -1 })).status).toBe(400);
  });

  it('user-foods: foodId required, unknown food is a 400 not a 500', async () => {
    expect((await http().post('/api/user-foods').set(H).send({})).status).toBe(400);
    const res = await http()
      .post('/api/user-foods')
      .set(H)
      .send({ foodId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
  });

  it('profile: rejects out-of-range values instead of silently dropping them', async () => {
    expect((await http().put('/api/auth/profile').set(H).send({ age: 5 })).status).toBe(
      400
    );
    const ok = await http().put('/api/auth/profile').set(H).send({ username: ' Neo ' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.username).toBe('Neo');
  });

  it('foods: users cannot self-verify entries (audit F11)', async () => {
    const res = await http().post('/api/foods').set(H).send({
      name: 'Homemade bar',
      proteinPer100g: 30,
      verified: true,
      isVerified: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.isVerified).toBe(false);
  });
});
