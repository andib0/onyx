import { describe, it, expect } from 'vitest';
import { generateAccessToken } from '../src/utils/jwt.js';
import { isFamilyLive, resetSessionCache } from '../src/services/sessionRevocation.js';
import { prisma } from '../src/config/database.js';
import { hashRefreshToken } from '../src/services/auth.service.js';
import { http, registerUser, loginUser, auth } from './helpers.js';

const me = (accessToken: string) =>
  http()
    .get('/api/auth/me')
    .set({ Authorization: `Bearer ${accessToken}` });

/** Audit F8: access tokens die with their session family, not 15 min later. */
describe('access-token revocation on logout', () => {
  it('logout on device B rejects B’s access token at once; A keeps working', async () => {
    const a = await registerUser();
    const b = await loginUser(a);
    expect((await me(b.accessToken)).status).toBe(200);

    expect((await http().post('/api/auth/logout').set(auth(b))).status).toBe(200);

    const bAfter = await me(b.accessToken);
    expect(bAfter.status).toBe(401);
    expect(bAfter.body.error).toBe('Session has been logged out');
    expect((await me(a.accessToken)).status).toBe(200);
  });

  it('holds after a restart (empty cache -> DB check)', async () => {
    const a = await registerUser();
    const b = await loginUser(a);
    await http().post('/api/auth/logout').set(auth(b));
    resetSessionCache();
    expect((await me(b.accessToken)).status).toBe(401);
    expect((await me(a.accessToken)).status).toBe(200);
  });

  it('refresh-token reuse also kills the family’s access tokens', async () => {
    const u = await registerUser();
    const rotated = await http()
      .post('/api/auth/refresh')
      .send({ refreshToken: u.refreshToken });
    const fresh: string = rotated.body.data.accessToken;
    expect((await me(fresh)).status).toBe(200);

    // Replay of the rotated token -> whole family revoked.
    await http().post('/api/auth/refresh').send({ refreshToken: u.refreshToken });
    expect((await me(fresh)).status).toBe(401);
    expect((await me(u.accessToken)).status).toBe(401);
  });

  it('rotation never leaves the family without a row (no false logouts)', async () => {
    const u = await registerUser();
    let token = u.refreshToken;
    for (let i = 0; i < 5; i++) {
      resetSessionCache();
      const [rot, check] = await Promise.all([
        http().post('/api/auth/refresh').send({ refreshToken: token }),
        me(u.accessToken),
      ]);
      expect(rot.status).toBe(200);
      expect(check.status).toBe(200);
      token = rot.body.data.refreshToken;
    }
  });

  it('rejects an access token that carries no session family', async () => {
    const u = await registerUser();
    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(u.refreshToken) },
    });
    const noFam = generateAccessToken(row!.userId, u.email);
    expect((await me(noFam)).status).toBe(401);
  });

  it('overhead: cached check is in-memory, a miss is one indexed lookup', async () => {
    const u = await registerUser();
    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(u.refreshToken) },
    });
    const { userId, familyId } = row!;
    const N = 200;
    const time = async (reset: boolean) => {
      const samples: number[] = [];
      for (let i = 0; i < N; i++) {
        if (reset) resetSessionCache();
        const t0 = process.hrtime.bigint();
        expect(await isFamilyLive(userId, familyId!)).toBe(true);
        samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
      }
      samples.sort((x, y) => x - y);
      return { p50: samples[N / 2], p95: samples[Math.floor(N * 0.95)] };
    };
    await time(true); // warm the pool
    const miss = await time(true);
    const hit = await time(false);
    console.log(
      `[F8 overhead] miss p50=${miss.p50.toFixed(3)}ms p95=${miss.p95.toFixed(3)}ms; ` +
        `hit p50=${hit.p50.toFixed(4)}ms p95=${hit.p95.toFixed(4)}ms`
    );
    expect(hit.p50).toBeLessThan(miss.p50);
  });
});
