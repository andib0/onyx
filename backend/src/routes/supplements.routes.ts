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

const router = Router();

router.use(authMiddleware);

router.get('/', getSupplements);
router.post('/', createSupplement);
router.put('/:id', updateSupplement);
router.delete('/:id', deleteSupplement);

// Logs
router.get('/logs', getLogs);
router.post('/:id/log', toggleLog);

export default router;
