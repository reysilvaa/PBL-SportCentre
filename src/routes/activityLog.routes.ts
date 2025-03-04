import express from 'express';
import { 
  getActivityLogs, 
  createActivityLog, 
  deleteActivityLog 
} from '../controllers/activityLog.controller';

const router = express.Router();

router.get('/', getActivityLogs);
router.post('/', createActivityLog);
router.delete('/:id', deleteActivityLog);

export default router;