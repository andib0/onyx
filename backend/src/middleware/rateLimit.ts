import rateLimit from 'express-rate-limit';

// API tests register many users per second; they opt out explicitly. The
// switch is ignored in production so a stray env var can't disable limits.
const skip = () =>
  process.env.DISABLE_RATE_LIMIT === '1' && process.env.NODE_ENV !== 'production';

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute for auth endpoints
  message: {
    success: false,
    error: 'Too many attempts. Please try again in a minute.',
  },
  standardHeaders: true,
  skip,
  legacyHeaders: false,
});

/**
 * /auth/refresh is unauthenticated and does a DB write per call (audit F6).
 * A real client refreshes at most every ~15 minutes per device.
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many refresh attempts. Please try again in a minute.',
  },
  standardHeaders: true,
  skip,
  legacyHeaders: false,
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  skip,
  legacyHeaders: false,
});
