import { Router } from 'express';
import { importState, exportState, getFullState } from '../controllers/sync.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.post('/import', importState);
router.get('/export', exportState);
router.get('/state', getFullState);

export default router;
