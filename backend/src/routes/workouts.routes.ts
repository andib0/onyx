import { Router } from 'express';
import {
  startSession,
  logSet,
  finishSession,
  getSessions,
  getExerciseHistory,
  getExerciseSessions,
  deleteSet,
} from '../controllers/workouts.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  startSessionSchema,
  logSetSchema,
  finishSessionSchema,
  sessionsQuerySchema,
  exerciseSessionsQuerySchema,
  exerciseHistoryQuerySchema,
} from '../validators/workouts.schema.js';
import { idParams } from '../validators/common.js';

const id = validate(idParams, 'params');

const router = Router();

router.use(authMiddleware);

router.get('/sessions', validate(sessionsQuerySchema, 'query'), getSessions);
router.get(
  '/exercise-history',
  validate(exerciseHistoryQuerySchema, 'query'),
  getExerciseHistory
);
router.get(
  '/exercise-sessions',
  validate(exerciseSessionsQuerySchema, 'query'),
  getExerciseSessions
);
router.post('/sessions', validate(startSessionSchema), startSession);
router.post('/sessions/:id/sets', id, validate(logSetSchema), logSet);
router.patch('/sessions/:id/finish', id, validate(finishSessionSchema), finishSession);
router.delete('/sets/:id', id, deleteSet);

export default router;
