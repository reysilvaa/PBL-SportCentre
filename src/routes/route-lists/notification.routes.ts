// src/routes/notification.routes.ts

import { Router } from 'express';
import {
  getNotifications,
  readNotification,
} from '../../controllers/webhook-handlers/notification.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';

const router = Router();

router.get(
  '/user/:userId',
  authMiddleware(['user', 'admin_cabang', 'owner_cabang', 'super_admin']),
  roleBasedController({
    all: getNotifications,
  })
);

router.patch(
  '/:id/read',
  authMiddleware(['user', 'admin_cabang', 'owner_cabang', 'super_admin']),
  roleBasedController({
    all: readNotification,
  })
);

export default router;
