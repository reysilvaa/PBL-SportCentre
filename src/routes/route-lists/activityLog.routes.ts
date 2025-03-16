import express from 'express';
import { 
  getActivityLogs, 
  createActivityLog, 
  deleteActivityLog 
} from '../../controllers/admin/super_admin/activityLog.controller';
import { parseIds } from '../../middlewares/parseId.middleware'; // parse into integer karena dto kirimkan string untuk userId (dto minta number)
import { superAdminAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = express.Router();

router.get('/', superAdminAuth, cacheMiddleware('activity_logs', 300), getActivityLogs);
router.post('/', superAdminAuth, parseIds, createActivityLog);
router.delete('/:id', superAdminAuth, deleteActivityLog);

export default router;
