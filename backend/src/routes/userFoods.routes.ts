import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { addUserFood, listUserFoods, removeUserFood } from '../controllers/userFoods.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listUserFoods);
router.post('/', addUserFood);
router.delete('/:id', removeUserFood);

export default router;
