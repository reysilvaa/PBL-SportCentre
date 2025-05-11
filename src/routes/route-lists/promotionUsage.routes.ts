import express from 'express';
import {
  getPromotionUsages,
  createPromotionUsage,
  deletePromotionUsage,
} from '../../controllers/promotionUsage.controller';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

router.get(
  '/',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang'],
  }),
  getPromotionUsages
);

router.post(
  '/',
  auth({
    allowedRoles: ['user'],
  }),
  createPromotionUsage
);

router.delete(
  '/:id',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang'],
  }),
  deletePromotionUsage
);

export default router;
