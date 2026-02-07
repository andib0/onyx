import { Router } from 'express';
import { searchFoods, getFood, createFood } from '../controllers/foods.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createFoodSchema } from '../validators/foods.schema.js';

const router = Router();

router.use(authMiddleware);

router.get('/', searchFoods);
router.get('/:id', getFood);
router.post('/', validate(createFoodSchema), createFood);

export default router;
