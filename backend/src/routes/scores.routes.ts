import { Router } from 'express';
import { upsertScore, getScores } from '../controllers/scores.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getScores);
router.post('/', upsertScore);

export default router;
