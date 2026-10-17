import { Router } from 'express';
import { upsertScore, getScores } from '../controllers/scores.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upsertScoreSchema } from '../validators/scores.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getScores);
router.post('/', validate(upsertScoreSchema), upsertScore);

export default router;
