import express from 'express';
import { 
  getBranches, 
  createBranch, 
  updateBranch, 
  deleteBranch 
} from '../../controllers/admin/super_admin/branch.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { cacheMiddleware } from '../../utils/cache';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = express.Router();

router.get('/', cacheMiddleware('branches', 300), getBranches);
router.post('/', authMiddleware(['super_admin']), parseIds, createBranch);
router.put('/:id', authMiddleware(['super_admin']), updateBranch);
router.delete('/:id', authMiddleware(['super_admin']), deleteBranch);

export default router;