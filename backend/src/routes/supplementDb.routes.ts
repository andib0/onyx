import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listSupplements } from '../controllers/supplementDb.controller.js';

const router = Router();

router.use(authMiddleware);
router.get('/', listSupplements);

export default router;
