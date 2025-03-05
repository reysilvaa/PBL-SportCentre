import express from 'express';
import { 
  getActivityLogs, 
  createActivityLog, 
  deleteActivityLog 
} from '../controllers/activityLog.controller';
import { parseUserId } from '../middlewares/parseUserId.middleware'; // parse into integer karena dto kirimkan string untuk userId (dto minta number)

const router = express.Router();

router.get('/', getActivityLogs);
router.post('/', parseUserId, createActivityLog);
router.delete('/:id', deleteActivityLog);

export default router;
