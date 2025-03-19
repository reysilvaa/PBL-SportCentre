import express from 'express';
import { 
  getBranches, 
  createBranch, 
  updateBranch, 
  deleteBranch 
} from '../../controllers/admin/super_admin/branch.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { authMiddleware, superAdminAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

router.get('/', cacheMiddleware('branches', 300), getBranches);
router.post('/', superAdminAuth, parseIds, createBranch);
router.put('/:id', superAdminAuth, updateBranch);
router.delete('/:id', superAdminAuth, deleteBranch);

export default router;