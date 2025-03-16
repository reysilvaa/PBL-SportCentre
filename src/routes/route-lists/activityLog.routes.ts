import express from 'express';
import { 
  getActivityLogs, 
  createActivityLog, 
  deleteActivityLog 
} from '../../controllers/admin/super_admin/activityLog.controller';
import { parseIds } from '../../middlewares/parseId.middleware'; // parse into integer karena dto kirimkan string untuk userId (dto minta number)
import { authMiddleware } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = express.Router();

router.get('/', authMiddleware(['super_admin']), cacheMiddleware('activity_logs', 300), getActivityLogs);
router.post('/', authMiddleware(['super_admin']), parseIds, createActivityLog);
router.delete('/:id', authMiddleware(['super_admin']), deleteActivityLog);

export default router;
