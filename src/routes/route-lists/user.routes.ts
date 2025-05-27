// src/routes/route-lists/user.routes.ts
import express from 'express';
import * as userController from '../../controllers/user.controller';
import { auth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

// Mendapatkan daftar pengguna (super admin dan admin cabang)
router.get(
  '/',
  auth({ allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'] }),
  cacheMiddleware('users_unified', 300),
  userController.getUsers
);

// Mendapatkan daftar admin cabang yang dimiliki/dikelola oleh user yang login
router.get(
  '/branch-admins',
  auth({ allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'] }),
  cacheMiddleware('user_branch_admins', 60),
  userController.getUserBranchAdmins
);

// Mendapatkan cabang untuk admin berdasarkan ID
router.get(
  '/:id/branches',
  auth({ allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'] }),
  cacheMiddleware('user_branches', 60),
  userController.getUserBranches
);

// Mendapatkan detail profil admin berdasarkan ID
router.get(
  '/detail/:id',
  auth({ allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'] }),
  cacheMiddleware('user_branches', 60),
  userController.getAdminProfile
);

// Mendapatkan profil pengguna (semua role, tapi hanya milik sendiri kecuali super admin)
router.get('/profile/:id?', auth(), cacheMiddleware('user_profile', 300), userController.getUserProfile);

// Update profil pengguna sendiri
router.put('/profile/:id?', auth(), userController.updateUserProfile);

// Membuat pengguna (super admin dan admin cabang)
router.post('/', auth({ allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'] }), userController.createUser);

// Mengupdate pengguna (super admin dan admin cabang)
router.put('/:id', auth({ allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'] }), userController.updateUser);

// Menghapus pengguna (super admin dan admin cabang)
router.delete(
  '/:id',
  auth({ allowedRoles: ['super_admin', 'admin_cabang', 'owner_cabang'] }),
  userController.deleteUser
);

// Mempertahankan backward compatibility untuk pendekatan lama
// Ini bisa dihapus setelah semua bagian frontend terupdate
// router.get('/all', superAdminAuth, cacheMiddleware('users_all', 300), userController.getUsers);
// router.get('/branch', branchAdminAuth, cacheMiddleware('users_branch', 300), userController.getUsers);
// router.get('/owner', ownerAuth, cacheMiddleware('users_owner', 300), userController.getUsers);

export default router;
