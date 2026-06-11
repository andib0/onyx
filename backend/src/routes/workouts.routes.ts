import { Router } from 'express';
import {
  startSession,
  logSet,
  finishSession,
  getSessions,
  getExerciseHistory,
} from '../controllers/workouts.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  startSessionSchema,
  logSetSchema,
  finishSessionSchema,
} from '../validators/workouts.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/sessions', getSessions);
router.get('/exercise-history', getExerciseHistory);
router.post('/sessions', validate(startSessionSchema), startSession);
router.post('/sessions/:id/sets', validate(logSetSchema), logSet);
router.patch('/sessions/:id/finish', validate(finishSessionSchema), finishSession);

export default router;
