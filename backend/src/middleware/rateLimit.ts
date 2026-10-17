import rateLimit from 'express-rate-limit';

// API tests register many users per second; they opt out explicitly.
const skip = () => process.env.DISABLE_RATE_LIMIT === '1';

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
