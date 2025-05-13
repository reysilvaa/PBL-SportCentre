import express from 'express';
import { getBranches, createBranch, updateBranch, deleteBranch, getUserBranches, getBranchAdmins } from '../../controllers/branch.controller';
import { getBranchFields } from '../../controllers/field.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { auth, superAdminAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { branchUpload } from '../../middlewares/multer.middleware';

const router = express.Router();

// Endpoint publik untuk mendapatkan semua cabang - dengan TTL sangat rendah
router.get('/', cacheMiddleware('branches', 10), getBranches);

// Endpoint untuk mendapatkan cabang yang dimiliki/dikelola oleh user yang login
router.get(
  '/owner-branches',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'],
  }),
  getUserBranches
);

// Mendapatkan detail cabang berdasarkan ID - dengan TTL sangat rendah
router.get(
  '/:id',
  cacheMiddleware('branch_detail', 10),
  auth({
    allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang', 'user'],
  }),
  getBranches
);

// Mendapatkan daftar admin cabang berdasarkan ID cabang
router.get(
  '/:id/admins',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'],
  }),
  getBranchAdmins
);

// Mendapatkan daftar lapangan cabang berdasarkan ID cabang
router.get(
  '/:id/fields',
  cacheMiddleware('branch_fields', 10),
  auth({
    allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang', 'user'],
  }),
  getBranchFields
);

// Pendekatan minimalis untuk operasi cabang
router.post('/', superAdminAuth(), branchUpload.single('imageUrl'), parseIds, createBranch);

// Update cabang dengan pendekatan minimalis
router.put(
  '/:id',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'],
    ownerOnly: true,
    resourceName: 'branch',
  }),
  branchUpload.single('imageUrl'),
  updateBranch
);

// Hapus cabang (hanya super admin)
router.delete('/:id', superAdminAuth(), deleteBranch);

export default router;
