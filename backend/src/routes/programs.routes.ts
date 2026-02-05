import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getProgram, listPrograms } from '../controllers/programs.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listPrograms);
router.get('/:id', getProgram);

export default router;
