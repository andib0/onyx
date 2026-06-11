import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { programSchema } from '../validators/programs.schema.js';
import {
  getProgram,
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
} from '../controllers/programs.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listPrograms);
router.get('/:id', getProgram);
router.post('/', validate(programSchema), createProgram);
router.put('/:id', validate(programSchema), updateProgram);
router.delete('/:id', deleteProgram);

export default router;
