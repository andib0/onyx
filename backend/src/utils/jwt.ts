import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types/index.js';
import { env } from '../config/env.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const ALGORITHM = 'HS256';

type TokenType = 'access' | 'refresh';

/**
 * Access tokens carry the session family (`fam`) so logout can revoke just
 * this device's refresh tokens even when the client sends no refresh token.
 */
export function generateAccessToken(
  userId: string,
  email: string,
  familyId?: string
): string {
  const payload: Record<string, string> = { sub: userId, email, typ: 'access' };
  if (familyId) payload.fam = familyId;
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Every refresh token gets a random `jti`, so two tokens issued in the same
 * second for the same user still differ (and hash to different rows).
 */
export function generateRefreshToken(
  userId: string,
  email: string,
  familyId: string
): string {
  return jwt.sign(
    { sub: userId, email, fam: familyId, typ: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { algorithm: ALGORITHM, expiresIn: REFRESH_TOKEN_EXPIRY, jwtid: randomUUID() }
  );
}

/**
 * Algorithm pinned (no `none`/HS384/RS256 confusion) and token type checked,
 * so an access token can never be used as a refresh token or vice versa even
 * if the two secrets were ever configured the same.
 */
function verify(token: string, secret: string, typ: TokenType): JWTPayload | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    if (typeof payload !== 'object' || payload === null) return null;
    const p = payload as Partial<JWTPayload>;
    if (p.typ !== typ || typeof p.sub !== 'string' || !p.sub) return null;
    return p as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): JWTPayload | null {
  return verify(token, env.JWT_SECRET, 'access');
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  return verify(token, env.JWT_REFRESH_SECRET, 'refresh');
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
}
