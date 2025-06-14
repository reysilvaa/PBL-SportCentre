import express from 'express';
import { getBranches, createBranch, updateBranch, deleteBranch, getUserBranches, addBranchAdmin, deleteBranchAdmin, getBranchAdminById, getBranchAdmins } from '../../controllers/branch.controller';
import { getBranchFields } from '../../controllers/field.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { auth, superAdminAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { branchUpload } from '../../middlewares/multer.middleware';
import { Role } from '../../types';

const router = express.Router();

// Endpoint publik untuk mendapatkan semua cabang - dengan TTL sangat rendah
router.get(
  '/', 
  cacheMiddleware('branches', 0), 
  getBranches
);

// Endpoint untuk mendapatkan cabang yang dimiliki/dikelola oleh user yang login
router.get(
  '/owner-branches',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG],
  }),
  getUserBranches
);

// Mendapatkan detail cabang berdasarkan ID - dengan TTL sangat rendah
router.get(
  '/:id',
  cacheMiddleware('branch_detail', 10),
  // auth({
  //   allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang', 'user'],
  // }),
  getBranches
);

// Mendapatkan daftar lapangan cabang berdasarkan ID cabang
router.get(
  '/:id/fields',
  cacheMiddleware('branch_fields', 10),
  // auth({
  //   allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang', 'user'],
  // }),
  getBranchFields
);

// Mendapatkan daftar admin cabang berdasarkan ID cabang
router.get(
  '/:id/admins',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.OWNER_CABANG],
    resourceName: 'branch',
  }),
  parseIds,
  getBranchAdmins
);

// Pendekatan minimalis untuk operasi cabang
router.post('/', superAdminAuth(), branchUpload.single('imageUrl'), parseIds, createBranch);

// Update cabang dengan pendekatan minimalis
router.put(
  '/:id',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG],
    ownerOnly: true,
    resourceName: 'branch',
  }),
  branchUpload.single('imageUrl'),
  updateBranch
);

// Mendapatkan data admin cabang berdasarkan ID user
router.get(
  '/admins/:id',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.OWNER_CABANG],
    // ownerOnly: true,
    resourceName: 'branch',
  }),
  parseIds,
  getBranchAdminById
);

// Mendapatkan data admin cabang berdasarkan ID cabang dan ID user
router.get(
  '/:id/admins/:userId',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.OWNER_CABANG],
    resourceName: 'branch',
  }),
  parseIds,
  getBranchAdminById
);

// Menambah data admin cabang berdasarkan ID cabang dan ID user
router.post(
  '/:id/admins/:userId',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.OWNER_CABANG],
    ownerOnly: true,
    resourceName: 'branch',
  }),
  parseIds,
  addBranchAdmin
);

// Hapus cabang (hanya super admin)
router.delete('/:id', superAdminAuth(), deleteBranch);

// Endpoint untuk menghapus admin cabang
router.delete(
  '/:id/admins/:userId',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.OWNER_CABANG],
    ownerOnly: true,
    resourceName: 'branch',
  }),
  parseIds,
  deleteBranchAdmin
);

export default router;
