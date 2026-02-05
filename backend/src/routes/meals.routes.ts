import { Router } from 'express';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  updateGrams,
  deleteTemplate,
  getLogs,
  toggleLog,
} from '../controllers/meals.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.patch('/templates/:id/grams', updateGrams);
router.delete('/templates/:id', deleteTemplate);

// Logs
router.get('/logs', getLogs);
router.post('/:id/log', toggleLog);

export default router;
