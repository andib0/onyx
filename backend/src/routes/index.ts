import { Router } from 'express';
import authRoutes from './auth.routes.js';
import scheduleRoutes from './schedule.routes.js';
import supplementsRoutes from './supplements.routes.js';
import mealsRoutes from './meals.routes.js';
import logsRoutes from './logs.routes.js';
import foodsRoutes from './foods.routes.js';
import programsRoutes from './programs.routes.js';
import supplementDbRoutes from './supplementDb.routes.js';
import syncRoutes from './sync.routes.js';
import preferencesRoutes from './preferences.routes.js';
import userFoodsRoutes from './userFoods.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/supplements', supplementsRoutes);
router.use('/meals', mealsRoutes);
router.use('/logs', logsRoutes);
router.use('/foods', foodsRoutes);
router.use('/programs', programsRoutes);
router.use('/supplement-db', supplementDbRoutes);
router.use('/sync', syncRoutes);
router.use('/preferences', preferencesRoutes);
router.use('/user-foods', userFoodsRoutes);

// Health check
router.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
