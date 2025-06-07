import express from 'express';
import {
  getPromotionUsages,
  createPromotionUsage,
  deletePromotionUsage,
} from '../../controllers/promotionUsage.controller';
import { auth } from '../../middlewares/auth.middleware';
import { Role } from '../../types';
const router = express.Router();

router.get(
  '/',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG],
  }),
  getPromotionUsages
);

router.post(
  '/',
  auth({
    allowedRoles: [Role.USER],
  }),
  createPromotionUsage
);

router.delete(
  '/:id',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG],
  }),
  deletePromotionUsage
);

export default router;
