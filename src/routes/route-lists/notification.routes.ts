// src/routes/notification.routes.ts

import { Router } from 'express';
import { 
  getNotifications, 
  readNotification, 
} from '../../controllers/webhooks/notification.controller';

const router = Router();

router.get('/user/:userId', getNotifications);
router.patch('/:id/read', readNotification);

export default router;