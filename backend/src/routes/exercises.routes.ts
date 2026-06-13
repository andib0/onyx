import { Router } from 'express';
import { searchExercises } from '../controllers/exercises.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/', searchExercises);

export default router;
