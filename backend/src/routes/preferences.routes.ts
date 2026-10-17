import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updatePreferencesSchema } from '../validators/preferences.schema.js';
import {
  getPreferences,
  updatePreferences,
} from '../controllers/preferences.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getPreferences);
router.put('/', validate(updatePreferencesSchema), updatePreferences);

export default router;
