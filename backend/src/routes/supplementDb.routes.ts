import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { supplementDbQuerySchema } from '../validators/supplementDb.schema.js';
import { listSupplements } from '../controllers/supplementDb.controller.js';

const router = Router();

router.use(authMiddleware);
router.get('/', validate(supplementDbQuerySchema, 'query'), listSupplements);

export default router;
