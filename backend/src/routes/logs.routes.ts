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
import {
  createOrUpdateLogSchema,
  logsQuerySchema,
  logStatsQuerySchema,
} from '../validators/logs.schema.js';
import { dateParams, idParams } from '../validators/common.js';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(logsQuerySchema, 'query'), getLogs);
router.get('/stats', validate(logStatsQuerySchema, 'query'), getStats);
router.get('/:date', validate(dateParams, 'params'), getLog);
router.post('/', validate(createOrUpdateLogSchema), createOrUpdateLog);
router.delete('/:id', validate(idParams, 'params'), deleteLog);

export default router;
