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
import { createSupplementSchema, updateSupplementSchema, toggleSupplementLogSchema } from '../validators/supplements.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getSupplements);
router.post('/', validate(createSupplementSchema), createSupplement);
router.put('/:id', validate(updateSupplementSchema), updateSupplement);
router.delete('/:id', deleteSupplement);

// Logs
router.get('/logs', getLogs);
router.post('/:id/log', validate(toggleSupplementLogSchema), toggleLog);

export default router;
