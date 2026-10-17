import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import type {
  LoginInput,
  ProfileInput,
  RegisterInput,
} from '../validators/auth.schema.js';
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendUnauthorized,
} from '../utils/response.js';
import { AppError, handleServiceError } from '../utils/errors.js';
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

/** The mobile app sends the refresh token in the body; browsers use the cookie. */
function presentedRefreshToken(req: Request): string | undefined {
  const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  if (typeof fromBody === 'string' && fromBody) return fromBody;
  const fromCookie = (req.cookies as Record<string, unknown> | undefined)?.[
    REFRESH_TOKEN_COOKIE
  ];
  return typeof fromCookie === 'string' && fromCookie ? fromCookie : undefined;
}

/** AppError messages are ours; anything else (Prisma, DB) becomes a generic 500. */
function fail(res: Response, error: unknown) {
  const appError = handleServiceError(error);
  return sendError(res, appError.message, appError.statusCode);
}

// Bodies below are already parsed by validate() in auth.routes.ts.

export async function register(req: Request, res: Response) {
  try {
    const { email, password, username, age, weight, heightCm, sex, timezone } =
      req.body as RegisterInput;
    const result = await authService.register(email, password, {
      username,
      age,
      weight,
      heightCm,
      sex,
      timezone,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    return sendCreated(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      'Account created successfully'
    );
  } catch (error) {
    return fail(res, error);
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as LoginInput;
    const result = await authService.login(email, password);

    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      'Login successful'
    );
  } catch (error) {
    if (error instanceof AppError) return sendError(res, error.message, error.statusCode);
    return fail(res, error);
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const refreshToken = presentedRefreshToken(req);

    if (!refreshToken) {
      return sendUnauthorized(res, 'No refresh token provided');
    }

    const result = await authService.refresh(refreshToken);

    // Set rotated refresh token cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    return sendSuccess(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    if (error instanceof AppError) return sendUnauthorized(res, error.message);
    return fail(res, error);
  }
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.userId) {
      const accessToken = req.headers.authorization?.slice(7);
      await authService.logout(req.userId, accessToken, presentedRefreshToken(req));
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return sendSuccess(res, null, 'Logged out successfully');
  } catch {
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return sendSuccess(res, null, 'Logged out');
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.userId) {
      return sendUnauthorized(res);
    }
    const { username, age, weight, heightCm, sex } = req.body as ProfileInput;
    const user = await authService.updateProfile(req.userId, {
      username,
      age,
      weight,
      heightCm,
      sex,
    });
    return sendSuccess(res, { user });
  } catch (error) {
    return fail(res, error);
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
    return fail(res, error);
  }
}
