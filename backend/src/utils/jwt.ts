import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types/index.js';
import { env } from './env.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Access tokens carry the session family (`fam`) so logout can revoke just
 * this device's refresh tokens even when the client sends no refresh token.
 */
export function generateAccessToken(
  userId: string,
  email: string,
  familyId?: string
): string {
  const payload: Record<string, string> = { sub: userId, email };
  if (familyId) payload.fam = familyId;
  return jwt.sign(payload, env.JWT_SECRET, {
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
  return jwt.sign({ sub: userId, email, fam: familyId }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    jwtid: randomUUID(),
  });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
}
