// src/routes/notification.routes.ts

import { Router } from 'express';
import { getNotifications, readNotification } from '../../controllers/webhook/notification.controller';
import { auth } from '../../middlewares/auth.middleware';
import { Role } from '../../types';
const router = Router();

router.get(
  '/user/:userId',
  auth({
    allowedRoles: [Role.USER, Role.ADMIN_CABANG, Role.OWNER_CABANG, Role.SUPER_ADMIN],
  }),
  getNotifications
);

router.patch(
  '/:id/read',
  auth({
    allowedRoles: [Role.USER, Role.ADMIN_CABANG, Role.OWNER_CABANG, Role.SUPER_ADMIN],
  }),
  readNotification
);

export default router;
