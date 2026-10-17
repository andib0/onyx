import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
  updateProfile,
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { authRateLimiter, refreshRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  profileSchema,
} from '../validators/auth.schema.js';

const router = Router();

// Public routes (with rate limiting)
router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post('/refresh', refreshRateLimiter, validate(refreshSchema), refresh);

// Protected routes
router.post('/logout', authMiddleware, validate(logoutSchema), logout);
router.get('/me', authMiddleware, me);
router.put('/profile', authMiddleware, validate(profileSchema), updateProfile);

export default router;
