import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

/**
 * Refresh tokens are high-entropy (random jti + signature), so a fast hash is
 * enough and lets us look the row up directly. bcrypt was wrong here twice
 * over: it is slow (O(n) compares per refresh) and only hashes the first 72
 * bytes, which every refresh JWT of a user shares (audit F1).
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  /** Issues an access + refresh pair in `familyId` (a new family when omitted). */
  private async issueTokens(user: { id: string; email: string }, familyId?: string) {
    const fam = familyId ?? randomUUID();
    const accessToken = generateAccessToken(user.id, user.email, fam);
    const refreshToken = generateRefreshToken(user.id, user.email, fam);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        familyId: fam,
        expiresAt: getRefreshTokenExpiry(),
      },
    });
    return { accessToken, refreshToken };
  }

  async register(
    email: string,
    password: string,
    profile?: { username?: string; age?: number; weight?: number; timezone?: string }
  ) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'DUPLICATE');
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        username: profile?.username || null,
        age: profile?.age || null,
        weight: profile?.weight || null,
        preferences: {
          // Use the device timezone when the client sends one; otherwise the
          // schema default applies.
          create: profile?.timezone ? { timezone: profile.timezone } : {},
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });

    const tokens = await this.issueTokens(user);
    return { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Expired tokens are never read again — clear them so the table doesn't
    // grow unbounded.
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lte: new Date() } },
    });

    const tokens = await this.issueTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    // Consume the token atomically: of N concurrent requests presenting the
    // same token, exactly one deletes the row and may rotate.
    const consumed = await prisma.refreshToken.deleteMany({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
    });

    if (consumed.count !== 1) {
      // A validly signed token with no live row was already rotated, logged
      // out, or revoked. Treat it as reuse: kill the whole family so whoever
      // holds the newer token (attacker or victim) must log in again.
      if (payload.fam) {
        await prisma.refreshToken.deleteMany({
          where: { userId: payload.sub, familyId: payload.fam },
        });
      }
      throw new AppError('Refresh token not found or expired', 401, 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new AppError('User not found', 401, 'INVALID_TOKEN');
    }

    await prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lte: new Date() } },
    });

    const tokens = await this.issueTokens(user, payload.fam);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user };
  }

  /**
   * Revokes only the session family of this device: taken from the presented
   * refresh token when there is one, otherwise from the access token's `fam`.
   * Other devices stay logged in.
   */
  async logout(userId: string, accessToken?: string, refreshToken?: string) {
    let familyId: string | undefined;
    if (refreshToken) {
      const payload = verifyRefreshToken(refreshToken);
      if (payload && payload.sub === userId) familyId = payload.fam;
    }
    if (!familyId && accessToken) {
      const payload = verifyAccessToken(accessToken);
      if (payload && payload.sub === userId) familyId = payload.fam;
    }
    if (!familyId) return;
    await prisma.refreshToken.deleteMany({ where: { userId, familyId } });
  }

  async updateProfile(
    userId: string,
    data: { username?: string; age?: number; weight?: number }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        age: true,
        weight: true,
        createdAt: true,
        preferences: true,
      },
    });
  }

  async getUser(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        age: true,
        weight: true,
        createdAt: true,
        preferences: true,
      },
    });
  }
}

export const authService = new AuthService();
