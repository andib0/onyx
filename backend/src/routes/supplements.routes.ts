import { Router } from 'express';
import {
  getSupplements,
  createSupplement,
  updateSupplement,
  deleteSupplement,
  getLogs,
  toggleLog,
} from '../controllers/supplements.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createSupplementSchema,
  updateSupplementSchema,
  toggleSupplementLogSchema,
  supplementLogsQuerySchema,
} from '../validators/supplements.schema.js';
import { idParams } from '../validators/common.js';

const id = validate(idParams, 'params');

const router = Router();

router.use(authMiddleware);

router.get('/', getSupplements);
router.post('/', validate(createSupplementSchema), createSupplement);
router.put('/:id', id, validate(updateSupplementSchema), updateSupplement);
router.delete('/:id', id, deleteSupplement);

// Logs
router.get('/logs', validate(supplementLogsQuerySchema, 'query'), getLogs);
router.post('/:id/log', id, validate(toggleSupplementLogSchema), toggleLog);

export default router;
