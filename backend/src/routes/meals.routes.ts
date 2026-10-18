import { Router } from 'express';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  updateGrams,
  deleteTemplate,
  getLogs,
  toggleLog,
  logOneOff,
} from '../controllers/meals.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createMealTemplateSchema,
  updateMealTemplateSchema,
  updateGramsSchema,
  toggleMealLogSchema,
  templatesQuerySchema,
  mealLogsQuerySchema,
  oneOffMealSchema,
} from '../validators/meals.schema.js';
import { idParams } from '../validators/common.js';
import { deleteBodySchema } from '../validators/common.schema.js';

const id = validate(idParams, 'params');

const router = Router();

router.use(authMiddleware);

router.get('/templates', validate(templatesQuerySchema, 'query'), getTemplates);
router.post('/templates', validate(createMealTemplateSchema), createTemplate);
router.put('/templates/:id', id, validate(updateMealTemplateSchema), updateTemplate);
router.patch('/templates/:id/grams', id, validate(updateGramsSchema), updateGrams);
router.delete('/templates/:id', id, validate(deleteBodySchema), deleteTemplate);

// Logs
// One-off food eaten today (dated template + eaten log, one request)
router.post('/one-off', validate(oneOffMealSchema), logOneOff);
router.get('/logs', validate(mealLogsQuerySchema, 'query'), getLogs);
router.post('/:id/log', id, validate(toggleMealLogSchema), toggleLog);

export default router;
