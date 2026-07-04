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
    const token = generateRefreshToken('user-1', 'a@b.com');
    expect(verifyRefreshToken(token)?.sub).toBe('user-1');
  });

  it('rejects tokens signed with the other secret', () => {
    const access = generateAccessToken('user-1', 'a@b.com');
    const refresh = generateRefreshToken('user-1', 'a@b.com');
    expect(verifyRefreshToken(access)).toBeNull();
    expect(verifyAccessToken(refresh)).toBeNull();
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
