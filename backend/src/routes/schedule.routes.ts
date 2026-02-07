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
import { validate } from '../middleware/validate.js';
import { createBlockSchema, updateBlockSchema, toggleCompletionSchema } from '../validators/schedule.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getBlocks);
router.post('/', validate(createBlockSchema), createBlock);
router.put('/:id', validate(updateBlockSchema), updateBlock);
router.delete('/:id', deleteBlock);

// Completions
router.get('/completions', getCompletions);
router.post('/completions', validate(toggleCompletionSchema), toggleCompletion);

export default router;
