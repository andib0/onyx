import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { addUserFoodSchema } from '../validators/userFoods.schema.js';
import {
  addUserFood,
  listUserFoods,
  removeUserFood,
} from '../controllers/userFoods.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listUserFoods);
router.post('/', validate(addUserFoodSchema), addUserFood);
router.delete('/:id', removeUserFood);

export default router;
