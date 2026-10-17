import { Router } from 'express';
import { today } from '../controllers/today.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/today?date=YYYY-MM-DD — query-only, so there is no body to validate;
// the date is checked in the controller.
router.get('/', today);

export default router;
