// src/routes/notification.routes.ts

import { Router } from 'express';
import {
  getNotifications,
  readNotification,
} from '../../controllers/webhook/notification.controller';
import { auth } from '../../middlewares/auth.middleware';

const router = Router();

router.get(
  '/user/:userId',
  auth({
    allowedRoles: ['user', 'admin_cabang', 'owner_cabang', 'super_admin'],
  }),
  getNotifications
);

router.patch(
  '/:id/read',
  auth({
    allowedRoles: ['user', 'admin_cabang', 'owner_cabang', 'super_admin'],
  }),
  readNotification
);

export default router;
