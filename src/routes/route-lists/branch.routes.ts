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
  authMiddleware,
} from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { branchAccessCheck, roleBasedController } from '../../middlewares/role.middleware';
import { branchUpload } from '../../middlewares/multer.middleware';

const router = express.Router();

// Endpoint publik untuk mendapatkan semua cabang
router.get('/', cacheMiddleware('branches', 300), getBranches);

// Mendapatkan detail cabang berdasarkan ID
router.get(
  '/:id',
  cacheMiddleware('branch_detail', 300),
  authMiddleware(['super_admin', 'admin_cabang', 'owner_cabang', 'user']),
  getBranches
);

// Pendekatan minimalis untuk operasi cabang
router.post(
  '/',
  authMiddleware(['super_admin']),
  branchUpload.single('imageUrl'),
  parseIds,
  roleBasedController({
    superAdmin: createBranch,
  })
);

// Update cabang dengan pendekatan minimalis
router.put(
  '/:id',
  authMiddleware(['super_admin', 'admin_cabang', 'owner_cabang']),
  branchUpload.single('imageUrl'),
  branchAccessCheck('id'),
  roleBasedController({
    superAdmin: updateBranch,
    branchAdmin: updateBranchAdmin,
    owner: updateBranchAdmin,
  })
);

// Hapus cabang (hanya super admin)
router.delete(
  '/:id',
  authMiddleware(['super_admin']),
  roleBasedController({
    superAdmin: deleteBranch,
  })
);

// Mempertahankan backward compatibility
// router.put('/admin/:id', branchAdminAuth, adminBranchMiddleware, branchUpload.single('imageUrl'), updateBranchAdmin);
// router.put('/owner/:id', ownerAuth, adminBranchMiddleware, branchUpload.single('imageUrl'), updateBranchAdmin);

export default router;
