import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  importState,
  exportState,
  getFullState,
  seedStarter,
} from '../controllers/sync.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate, VALIDATES } from '../middleware/validate.js';
import { importStateSchema, importV2Schema } from '../validators/sync.schema.js';
import { emptyBody } from '../validators/common.js';

const router = Router();

router.use(authMiddleware);

const validateV1 = validate(importStateSchema);
const validateV2 = validate(importV2Schema);
// `?v=2` selects the full, id-preserving backup format. Marked as a body
// validator for the route-coverage test (it delegates to a Zod validate()).
const validateImport = Object.assign(
  (req: Request, res: Response, next: NextFunction) =>
    req.query.v === '2' ? validateV2(req, res, next) : validateV1(req, res, next),
  { [VALIDATES]: 'body' as const }
);

router.post('/import', validateImport, importState);
router.get('/export', exportState);
router.get('/state', getFullState);
router.post('/seed-starter', validate(emptyBody), seedStarter);

export default router;
