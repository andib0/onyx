import { Router } from 'express';
import { searchFoods, getFood, createFood } from '../controllers/foods.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', searchFoods);
router.get('/:id', getFood);
router.post('/', createFood);

export default router;
