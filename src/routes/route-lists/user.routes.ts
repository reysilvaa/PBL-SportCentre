// src/routes/route-lists/user.routes.ts
import express from 'express';
import * as userController from '../../controllers/user.controller';
import { auth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { Role } from '../../types';
const router = express.Router();

// Mendapatkan daftar pengguna (super admin dan admin cabang)
router.get(
  '/',
  auth({ allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG] }),
  cacheMiddleware('users_unified', 300),
  userController.getUsers
);

// Mendapatkan daftar pengguna berdasarkan role
router.get(
  '/by-role/:role',
  auth({ allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG] }),
  cacheMiddleware('users_by_role', 300),
  userController.getUsersByRole
);

// Mendapatkan daftar admin cabang yang dimiliki/dikelola oleh user yang login
router.get(
  '/branch-admins',
  auth({ allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG] }),
  cacheMiddleware('user_branch_admins', 60),
  userController.getUserBranchAdmins
);

// Mendapatkan cabang untuk admin berdasarkan ID
router.get(
  '/:id/branches',
  auth({ allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG] }),
  cacheMiddleware('user_branches', 60),
  userController.getUserBranches
);

// Mendapatkan detail profil admin berdasarkan ID
router.get(
  '/detail/:id',
  auth({ allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG] }),
  cacheMiddleware('user_branches', 60),
  userController.getAdminProfile
);

// Mendapatkan profil pengguna sendiri (tanpa ID)
router.get('/profile', auth(), cacheMiddleware('user_profile', 300), userController.getUserProfile);

// Mendapatkan profil pengguna berdasarkan ID
router.get('/profile/:id', auth(), cacheMiddleware('user_profile', 300), userController.getUserProfile);

// Update profil pengguna sendiri (tanpa ID)
router.put('/profile', auth(), userController.updateUserProfile);

// Update profil pengguna berdasarkan ID
router.put('/profile/:id', auth(), userController.updateUserProfile);

// Membuat pengguna (super admin dan admin cabang)
router.post('/', auth({ allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG] }), userController.createUser);

// Mengupdate pengguna (super admin dan admin cabang)
router.put('/:id', auth({ allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG] }), userController.updateUser);

// Menghapus pengguna (super admin dan admin cabang)
router.delete(
  '/:id',
  auth({ allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG, Role.OWNER_CABANG] }),
  userController.deleteUser
);

// Mempertahankan backward compatibility untuk pendekatan lama
// Ini bisa dihapus setelah semua bagian frontend terupdate
// router.get('/all', superAdminAuth, cacheMiddleware('users_all', 300), userController.getUsers);
// router.get('/branch', branchAdminAuth, cacheMiddleware('users_branch', 300), userController.getUsers);
// router.get('/owner', ownerAuth, cacheMiddleware('users_owner', 300), userController.getUsers);

export default router;
