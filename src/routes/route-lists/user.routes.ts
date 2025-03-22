// src/routes/userRoutes.ts
import express from 'express';
import * as userController from '../../controllers/admin/super_admin/user.controller';
import {
  superAdminAuth,
  branchAdminAuth,
  ownerAuth,
} from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

// Super Admin Routes
router.get(
  '/all',
  superAdminAuth,
  cacheMiddleware('users_all', 300),
  userController.getUsers,
);
router.post('/admin', superAdminAuth, userController.createUser);
router.put('/admin/:id', superAdminAuth, userController.updateUser);
router.delete('/admin/:id', superAdminAuth, userController.deleteUser);

// Branch Admin Routes
router.get(
  '/branch',
  branchAdminAuth,
  cacheMiddleware('users_branch', 300),
  userController.getUsers,
);
router.post('/branch', branchAdminAuth, userController.createUser);
router.put('/branch/:id', branchAdminAuth, userController.updateUser);
router.delete('/branch/:id', branchAdminAuth, userController.deleteUser);

// Owner Routes
router.get(
  '/owner',
  ownerAuth,
  cacheMiddleware('users_owner', 300),
  userController.getUsers,
);

export default router;
