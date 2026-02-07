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
import { validate } from '../middleware/validate.js';
import { createMealTemplateSchema, updateMealTemplateSchema, updateGramsSchema, toggleMealLogSchema } from '../validators/meals.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/templates', getTemplates);
router.post('/templates', validate(createMealTemplateSchema), createTemplate);
router.put('/templates/:id', validate(updateMealTemplateSchema), updateTemplate);
router.patch('/templates/:id/grams', validate(updateGramsSchema), updateGrams);
router.delete('/templates/:id', deleteTemplate);

// Logs
router.get('/logs', getLogs);
router.post('/:id/log', validate(toggleMealLogSchema), toggleLog);

export default router;
