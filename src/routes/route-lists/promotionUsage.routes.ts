import express from 'express';
import {
  getPromotionUsages,
  createPromotionUsage,
  deletePromotionUsage,
} from '../../controllers/all/promotionUsage.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';

const router = express.Router();

router.get(
  '/',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: getPromotionUsages,
    branchAdmin: getPromotionUsages,
  })
);

router.post(
  '/',
  authMiddleware(['user']),
  roleBasedController({
    user: createPromotionUsage,
  })
);

router.delete(
  '/:id',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: deletePromotionUsage,
    branchAdmin: deletePromotionUsage,
  })
);

export default router;
