import express from 'express';
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from '../../controllers/promotion.controller';
import { auth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { Role } from '../../types';
const router = express.Router();

router.get('/', cacheMiddleware('promotions', 300), getPromotions);

router.post(
  '/',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG],
  }),
  createPromotion
);

router.put(
  '/:id',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG],
  }),
  updatePromotion
);

router.delete(
  '/:id',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG],
  }),
  deletePromotion
);

export default router;
