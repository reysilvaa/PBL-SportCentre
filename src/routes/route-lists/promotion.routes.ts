import express from 'express';
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from '../../controllers/promotion.controller';
import { auth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

router.get('/', cacheMiddleware('promotions', 300), getPromotions);

router.post(
  '/',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang'],
  }),
  createPromotion,
);

router.put(
  '/:id',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang'],
  }),
  updatePromotion,
);

router.delete(
  '/:id',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang'],
  }),
  deletePromotion,
);

export default router;
