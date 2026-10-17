import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { programSchema, updateProgramSchema } from '../validators/programs.schema.js';
import { idParams } from '../validators/common.js';
import {
  getProgram,
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
} from '../controllers/programs.controller.js';

const router = Router();
const id = validate(idParams, 'params');

router.use(authMiddleware);

router.get('/', listPrograms);
router.get('/:id', id, getProgram);
router.post('/', validate(programSchema), createProgram);
router.put('/:id', id, validate(updateProgramSchema), updateProgram);
router.delete('/:id', id, deleteProgram);

export default router;
