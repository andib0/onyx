import { Router } from 'express';
import {
  getBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  getCompletions,
  toggleCompletion,
} from '../controllers/schedule.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getBlocks);
router.post('/', createBlock);
router.put('/:id', updateBlock);
router.delete('/:id', deleteBlock);

// Completions
router.get('/completions', getCompletions);
router.post('/completions', toggleCompletion);

export default router;
