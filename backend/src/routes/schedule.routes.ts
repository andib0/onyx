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
import {
  createBlockSchema,
  updateBlockSchema,
  toggleCompletionSchema,
  completionsQuerySchema,
} from '../validators/schedule.schema.js';
import { idParams } from '../validators/common.js';
import { deleteBodySchema } from '../validators/common.schema.js';

const id = validate(idParams, 'params');

const router = Router();

router.use(authMiddleware);

router.get('/', getBlocks);
router.post('/', validate(createBlockSchema), createBlock);
router.put('/:id', id, validate(updateBlockSchema), updateBlock);
router.delete('/:id', id, validate(deleteBodySchema), deleteBlock);

// Completions
router.get('/completions', validate(completionsQuerySchema, 'query'), getCompletions);
router.post('/completions', validate(toggleCompletionSchema), toggleCompletion);

export default router;
