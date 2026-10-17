import { prisma } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../utils/jwt.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';

export class AuthService {
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

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    // Store refresh token hash
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return { user, accessToken, refreshToken };
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

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    // Expired tokens are never read again — clear them so the table doesn't
    // grow unbounded and refresh() doesn't bcrypt-compare against dead rows.
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lte: new Date() } },
    });

    // Store refresh token hash
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    // Find and validate stored token
    const storedTokens = await prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
    });

    let validToken = null;
    for (const token of storedTokens) {
      const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
      if (isMatch) {
        validToken = token;
        break;
      }
    }

    if (!validToken) {
      // Possible replay attack — a rotated token was reused.
      // Invalidate all refresh tokens for this user as a precaution.
      await prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
      throw new AppError('Refresh token not found or expired', 401, 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new AppError('User not found', 401, 'INVALID_TOKEN');
    }

    // Rotate: delete old token (and any expired leftovers), issue new pair
    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ id: validToken.id }, { expiresAt: { lte: new Date() } }],
      },
    });

    const newAccessToken = generateAccessToken(user.id, user.email);
    const newRefreshToken = generateRefreshToken(user.id, user.email);

    const tokenHash = await bcrypt.hash(newRefreshToken, 10);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, user };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // Delete specific token
      const storedTokens = await prisma.refreshToken.findMany({
        where: { userId },
      });

      for (const token of storedTokens) {
        const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
        if (isMatch) {
          await prisma.refreshToken.delete({ where: { id: token.id } });
          break;
        }
      }
    } else {
      // Delete all refresh tokens for user (logout from all devices)
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }
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
