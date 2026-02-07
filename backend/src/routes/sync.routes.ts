import { Router } from 'express';
import { importState, exportState, getFullState } from '../controllers/sync.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { importStateSchema } from '../validators/sync.schema.js';

const router = Router();

router.use(authMiddleware);

router.post('/import', validate(importStateSchema), importState);
router.get('/export', exportState);
router.get('/state', getFullState);

export default router;
