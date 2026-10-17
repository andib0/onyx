import { Router } from 'express';
import { searchFoods, getFood, createFood } from '../controllers/foods.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createFoodSchema, searchFoodsQuerySchema } from '../validators/foods.schema.js';
import { idParams } from '../validators/common.js';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(searchFoodsQuerySchema, 'query'), searchFoods);
router.get('/:id', validate(idParams, 'params'), getFood);
router.post('/', validate(createFoodSchema), createFood);

export default router;
