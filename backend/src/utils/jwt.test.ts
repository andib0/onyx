import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from './jwt.js';

describe('jwt utils', () => {
  it('round-trips an access token', () => {
    const token = generateAccessToken('user-1', 'a@b.com');
    const payload = verifyAccessToken(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.email).toBe('a@b.com');
  });

  it('round-trips a refresh token', () => {
    const token = generateRefreshToken('user-1', 'a@b.com', 'fam-1');
    expect(verifyRefreshToken(token)?.sub).toBe('user-1');
  });

  it('rejects tokens signed with the other secret', () => {
    const access = generateAccessToken('user-1', 'a@b.com');
    const refresh = generateRefreshToken('user-1', 'a@b.com', 'fam-1');
    expect(verifyRefreshToken(access)).toBeNull();
    expect(verifyAccessToken(refresh)).toBeNull();
  });

  it('gives every refresh token a unique jti and carries the family', () => {
    const a = generateRefreshToken('user-1', 'a@b.com', 'fam-1');
    const b = generateRefreshToken('user-1', 'a@b.com', 'fam-1');
    expect(a).not.toBe(b);
    expect(verifyRefreshToken(a)?.jti).not.toBe(verifyRefreshToken(b)?.jti);
    expect(verifyRefreshToken(a)?.fam).toBe('fam-1');
  });

  it('rejects garbage tokens', () => {
    expect(verifyAccessToken('not-a-token')).toBeNull();
  });

  it('refresh expiry is ~7 days out', () => {
    const diff = getRefreshTokenExpiry().getTime() - Date.now();
    expect(diff).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });
});

describe('jwt hardening (audit F13)', () => {
  const accessSecret = process.env.JWT_SECRET!;
  const refreshSecret = process.env.JWT_REFRESH_SECRET!;

  it('stamps typ on both token kinds', () => {
    expect(verifyAccessToken(generateAccessToken('u', 'a@b.com'))?.typ).toBe('access');
    expect(verifyRefreshToken(generateRefreshToken('u', 'a@b.com', 'f'))?.typ).toBe(
      'refresh'
    );
  });

  it('rejects a refresh-typed token signed with the access secret', () => {
    const forged = jwt.sign({ sub: 'u', email: 'a@b.com', typ: 'refresh' }, accessSecret);
    expect(verifyAccessToken(forged)).toBeNull();
  });

  it('rejects an access-typed token signed with the refresh secret', () => {
    const forged = jwt.sign({ sub: 'u', email: 'a@b.com', typ: 'access' }, refreshSecret);
    expect(verifyRefreshToken(forged)).toBeNull();
  });

  it('rejects tokens without typ (pre-hardening tokens)', () => {
    const legacy = jwt.sign({ sub: 'u', email: 'a@b.com' }, accessSecret);
    expect(verifyAccessToken(legacy)).toBeNull();
  });

  it('rejects other algorithms even with the right secret', () => {
    const hs512 = jwt.sign({ sub: 'u', email: 'a@b.com', typ: 'access' }, accessSecret, {
      algorithm: 'HS512',
    });
    expect(verifyAccessToken(hs512)).toBeNull();
    const none = jwt.sign({ sub: 'u', email: 'a@b.com', typ: 'access' }, '', {
      algorithm: 'none',
    });
    expect(verifyAccessToken(none)).toBeNull();
  });
});
