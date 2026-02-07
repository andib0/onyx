import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { registerSchema, loginSchema } from '../validators/auth.schema.js';
import { sendSuccess, sendCreated, sendError, sendUnauthorized } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0].message);
    }

    const { email, password, username, age, weight } = parsed.data;
    const result = await authService.register(email, password, { username, age, weight });

    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    return sendCreated(res, {
      user: result.user,
      accessToken: result.accessToken,
    }, 'Account created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return sendError(res, message);
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0].message);
    }

    const { email, password } = parsed.data;
    const result = await authService.login(email, password);

    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
    }, 'Login successful');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return sendUnauthorized(res, message);
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] || req.body.refreshToken;

    if (!refreshToken) {
      return sendUnauthorized(res, 'No refresh token provided');
    }

    const result = await authService.refresh(refreshToken);

    // Set rotated refresh token cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(res, {
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return sendUnauthorized(res, message);
  }
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  try {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];

    if (req.userId) {
      await authService.logout(req.userId, refreshToken);
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return sendSuccess(res, null, 'Logged out successfully');
  } catch {
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return sendSuccess(res, null, 'Logged out');
  }
}

export async function me(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.userId) {
      return sendUnauthorized(res);
    }

    const user = await authService.getUser(req.userId);
    if (!user) {
      return sendUnauthorized(res, 'User not found');
    }

    return sendSuccess(res, { user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user';
    return sendError(res, message);
  }
}
