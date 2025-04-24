// src/routes/route-lists/user.routes.ts
import express from 'express';
import * as userController from '../../controllers/admin/super_admin/user.controller';
import {
  superAdminAuth,
  branchAdminAuth,
  ownerAuth,
  authMiddleware,
} from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

// Pendekatan minimalis untuk mendapatkan pengguna dengan satu endpoint
router.get(
  '/',
  authMiddleware(['super_admin', 'admin_cabang', 'owner_cabang']),
  cacheMiddleware('users_unified', 300),
  roleBasedController({
    superAdmin: userController.getUsers,
    branchAdmin: userController.getUsers,
    owner: userController.getUsers,
  })
);

// Pendekatan minimalis untuk membuat pengguna
router.post(
  '/',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: userController.createUser,
    branchAdmin: userController.createUser,
  })
);

// Pendekatan minimalis untuk mengupdate pengguna
router.put(
  '/:id',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: userController.updateUser,
    branchAdmin: userController.updateUser,
  })
);

// Pendekatan minimalis untuk menghapus pengguna
router.delete(
  '/:id',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: userController.deleteUser,
    branchAdmin: userController.deleteUser,
  })
);

// Mempertahankan backward compatibility untuk pendekatan lama
// Ini bisa dihapus setelah semua bagian frontend terupdate
// router.get('/all', superAdminAuth, cacheMiddleware('users_all', 300), userController.getUsers);
// router.get('/branch', branchAdminAuth, cacheMiddleware('users_branch', 300), userController.getUsers);
// router.get('/owner', ownerAuth, cacheMiddleware('users_owner', 300), userController.getUsers);

export default router;
