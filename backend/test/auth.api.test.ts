import { describe, it, expect } from 'vitest';
import { prisma } from '../src/config/database.js';
import { hashRefreshToken } from '../src/services/auth.service.js';
import { http, registerUser, loginUser, auth } from './helpers.js';

const refresh = (refreshToken: string) =>
  http().post('/api/auth/refresh').send({ refreshToken });

async function familyOf(refreshToken: string) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
  });
  return row?.familyId ?? null;
}

describe('health', () => {
  it('responds ok', async () => {
    const res = await http().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('auth', () => {
  it('registers, reads /me, and rejects bad credentials', async () => {
    const u = await registerUser();
    const me = await http().get('/api/auth/me').set(auth(u));
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(u.email);

    const bad = await http()
      .post('/api/auth/login')
      .send({ email: u.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('rejects requests without a token', async () => {
    const res = await http().get('/api/schedule');
    expect(res.status).toBe(401);
  });
});

describe('refresh token rotation (audit F1)', () => {
  it('refuses a refresh token that was already rotated', async () => {
    const u = await registerUser();
    const first = await refresh(u.refreshToken);
    expect(first.status).toBe(200);
    const reuse = await refresh(u.refreshToken);
    expect(reuse.status).toBe(401);
  });

  it('rotation yields a different refresh token and a working access token', async () => {
    const u = await registerUser();
    const res = await refresh(u.refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(u.refreshToken);
    const me = await http()
      .get('/api/auth/me')
      .set({ Authorization: `Bearer ${res.body.data.accessToken}` });
    expect(me.status).toBe(200);
  });

  it('stores sha256(token), never the token itself', async () => {
    const u = await registerUser();
    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(u.refreshToken) },
    });
    expect(row).not.toBeNull();
    expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.familyId).toBeTruthy();
  });

  it('reuse of a rotated token returns 401 and revokes the whole family', async () => {
    const u = await registerUser();
    const fam = await familyOf(u.refreshToken);
    const rotated = await refresh(u.refreshToken);
    const newToken: string = rotated.body.data.refreshToken;
    expect(await familyOf(newToken)).toBe(fam);

    // Attacker replays the old token.
    expect((await refresh(u.refreshToken)).status).toBe(401);
    // ...which kills the legitimate holder's newer token as well.
    expect(await prisma.refreshToken.count({ where: { familyId: fam } })).toBe(0);
    expect((await refresh(newToken)).status).toBe(401);
  });

  it('accepts the refresh token from the cookie as well as the body', async () => {
    const u = await registerUser();
    const res = await http()
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${u.refreshToken}`);
    expect(res.status).toBe(200);
  });

  it('logout on device B leaves device A logged in', async () => {
    const a = await registerUser();
    const b = await loginUser(a);
    expect(await familyOf(a.refreshToken)).not.toBe(await familyOf(b.refreshToken));

    const out = await http().post('/api/auth/logout').set(auth(b));
    expect(out.status).toBe(200);

    expect((await refresh(b.refreshToken)).status).toBe(401);
    expect((await refresh(a.refreshToken)).status).toBe(200);
  });

  it('logout with an explicit refresh token revokes that family only', async () => {
    const a = await registerUser();
    const b = await loginUser(a);
    const out = await http()
      .post('/api/auth/logout')
      .set(auth(a))
      .send({ refreshToken: b.refreshToken });
    expect(out.status).toBe(200);
    expect((await refresh(b.refreshToken)).status).toBe(401);
    expect((await refresh(a.refreshToken)).status).toBe(200);
  });

  it('concurrent refresh of the same token: exactly one succeeds', async () => {
    const u = await registerUser();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => refresh(u.refreshToken))
    );
    const ok = results.filter((r) => r.status === 200);
    expect(ok).toHaveLength(1);
    expect(results.filter((r) => r.status === 401)).toHaveLength(4);
  });

  it('rejects a garbage refresh token and a missing one', async () => {
    expect((await refresh('not-a-jwt')).status).toBe(401);
    expect((await http().post('/api/auth/refresh').send({})).status).toBe(401);
  });
});
