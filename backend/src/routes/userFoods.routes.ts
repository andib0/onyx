import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { addUserFoodSchema } from '../validators/userFoods.schema.js';
import { idParams } from '../validators/common.js';
import { deleteBodySchema } from '../validators/common.schema.js';
import {
  addUserFood,
  listUserFoods,
  removeUserFood,
} from '../controllers/userFoods.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listUserFoods);
router.post('/', validate(addUserFoodSchema), addUserFood);
router.delete(
  '/:id',
  validate(idParams, 'params'),
  validate(deleteBodySchema),
  removeUserFood
);

export default router;
