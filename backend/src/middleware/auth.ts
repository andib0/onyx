import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { sendUnauthorized } from '../utils/response.js';
import { isFamilyLive } from '../services/sessionRevocation.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Verifies the bearer token, then checks that its session family has not been
 * logged out or revoked (audit F8). Tokens without a family are rejected: every
 * token issued since F1 carries one.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'No token provided');
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload || !payload.fam) {
    return sendUnauthorized(res, 'Invalid or expired token');
  }

  try {
    if (!(await isFamilyLive(payload.sub, payload.fam))) {
      return sendUnauthorized(res, 'Session has been logged out');
    }
  } catch (err) {
    return next(err);
  }

  req.userId = payload.sub;
  req.user = {
    id: payload.sub,
    email: payload.email,
  };

  next();
}
