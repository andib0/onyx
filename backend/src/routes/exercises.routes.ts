import { Router } from 'express';
import { searchExercises } from '../controllers/exercises.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { searchExercisesQuerySchema } from '../validators/exercises.schema.js';

const router = Router();

router.use(authMiddleware);
router.get('/', validate(searchExercisesQuerySchema, 'query'), searchExercises);

export default router;
