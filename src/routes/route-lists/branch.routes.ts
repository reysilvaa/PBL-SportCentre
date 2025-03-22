import express from 'express';
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from '../../controllers/admin/super_admin/branch.controller';
import { updateBranch as updateBranchAdmin } from '../../controllers/admin/admin_cabang/branch.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import {
  superAdminAuth,
  branchAdminAuth,
  ownerAuth,
} from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { adminBranchMiddleware } from '../../middlewares/adminBranch.middleware';
import { branchUpload } from '../../middlewares/multer.middleware';

const router = express.Router();

// Public routes
router.get('/', cacheMiddleware('branches', 300), getBranches);

// Super Admin routes
router.post(
  '/',
  superAdminAuth,
  branchUpload.single('imageUrl'),
  parseIds,
  createBranch,
);
router.put(
  '/:id',
  superAdminAuth,
  branchUpload.single('imageUrl'),
  updateBranch,
);
router.delete('/:id', superAdminAuth, deleteBranch);

// Admin Cabang routes
router.put(
  '/admin/:id',
  branchAdminAuth,
  adminBranchMiddleware,
  branchUpload.single('imageUrl'),
  updateBranchAdmin,
);

// Owner Cabang routes - menggunakan controller yang sama dengan admin cabang
router.put(
  '/owner/:id',
  ownerAuth,
  adminBranchMiddleware,
  branchUpload.single('imageUrl'),
  updateBranchAdmin,
);

export default router;
