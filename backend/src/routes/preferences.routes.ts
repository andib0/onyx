import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getPreferences, updatePreferences } from '../controllers/preferences.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getPreferences);
router.put('/', updatePreferences);

export default router;
