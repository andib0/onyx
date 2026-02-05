import { Router } from 'express';
import {
  getLogs,
  getLog,
  createOrUpdateLog,
  deleteLog,
  getStats,
} from '../controllers/logs.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getLogs);
router.get('/stats', getStats);
router.get('/:date', getLog);
router.post('/', createOrUpdateLog);
router.delete('/:id', deleteLog);

export default router;
