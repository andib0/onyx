import { describe, it, expect } from 'vitest';
import { http, registerUser, auth } from './helpers.js';

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

    const bad = await http().post('/api/auth/login').send({ email: u.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('rejects requests without a token', async () => {
    const res = await http().get('/api/schedule');
    expect(res.status).toBe(401);
  });

  // Known bug (F1): tokens carry no jti, so a refresh within the same second
  // returns a byte-identical token. Flips red once rotation is real.
  it.fails('rotates the refresh token', async () => {
    const u = await registerUser();
    const res = await http().post('/api/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.refreshToken).not.toBe(u.refreshToken);
  });

  // Known bug (docs/audit/03-security.md F1): bcrypt truncates at 72 bytes, so a
  // rotated-out refresh token still validates. `it.fails` flips red once fixed.
  it.fails('refuses a refresh token that was already rotated', async () => {
    const u = await registerUser();
    await http().post('/api/auth/refresh').send({ refreshToken: u.refreshToken });
    const reuse = await http().post('/api/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(reuse.status).toBe(401);
  });
});
