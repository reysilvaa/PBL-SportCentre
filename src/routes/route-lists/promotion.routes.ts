import express from 'express';
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from '../../controllers/all/promotion.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

router.get('/', cacheMiddleware('promotions', 300), getPromotions);

router.post(
  '/',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: createPromotion,
    branchAdmin: createPromotion,
  })
);

router.put(
  '/:id',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: updatePromotion,
    branchAdmin: updatePromotion,
  })
);

router.delete(
  '/:id',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: deletePromotion,
    branchAdmin: deletePromotion,
  })
);

export default router;
