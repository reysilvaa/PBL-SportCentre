import express from 'express';
import { 
  getActivityLogs, 
  createActivityLog, 
  deleteActivityLog 
} from '../../controllers/admin/super_admin/activityLog.controller';
import { parseIds } from '../../middlewares/parseId.middleware'; // parse into integer karena dto kirimkan string untuk userId (dto minta number)
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = express.Router();

router.get('/', authMiddleware(['super_admin']), getActivityLogs);
router.get('/', getActivityLogs);
router.post('/', parseIds, createActivityLog);
router.delete('/:id', deleteActivityLog);

export default router;
