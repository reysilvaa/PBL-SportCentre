import express from 'express';
import {
  getActivityLogs,
  createActivityLog,
  deleteActivityLog,
} from '../../controllers/admin/super_admin/activityLog.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

router.get(
  '/',
  authMiddleware(['super_admin']),
  cacheMiddleware('activity_logs', 300),
  roleBasedController({
    superAdmin: getActivityLogs,
  })
);

router.post(
  '/',
  parseIds,
  roleBasedController({
    superAdmin: createActivityLog,
  })
);

router.delete(
  '/:id',
  authMiddleware(['super_admin']),
  roleBasedController({
    superAdmin: deleteActivityLog,
  })
);

export default router;
