import express from 'express';
import { 
  getBranches, 
  createBranch, 
  updateBranch, 
  deleteBranch 
} from '../../controllers/admin/super_admin/branch.controller';
import { parseIds } from '../../middlewares/parseId.middleware';

const router = express.Router();

router.get('/', getBranches);
router.post('/', parseIds, createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

export default router;