import { Router } from 'express';
import {
  getLogs,
  getLog,
  createOrUpdateLog,
  deleteLog,
  getStats,
} from '../controllers/logs.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createOrUpdateLogSchema } from '../validators/logs.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getLogs);
router.get('/stats', getStats);
router.get('/:date', getLog);
router.post('/', validate(createOrUpdateLogSchema), createOrUpdateLog);
router.delete('/:id', deleteLog);

export default router;
