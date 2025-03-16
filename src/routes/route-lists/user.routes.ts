// src/routes/userRoutes.ts
import express from 'express';
import * as userController from '../../controllers/admin/super_admin/user.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = express.Router();

// Super Admin Routes
router.get('/all', authMiddleware(['super_admin']), cacheMiddleware('users_all', 300), userController.getUsers);
router.post('/admin', authMiddleware(['super_admin']), userController.createUser);
router.put('/admin/:id', authMiddleware(['super_admin']), userController.updateUser);
router.delete('/admin/:id', authMiddleware(['super_admin']), userController.deleteUser);

// Branch Admin Routes
router.get('/branch', authMiddleware(['admin_cabang']), cacheMiddleware('users_branch', 300), userController.getUsers);
router.post('/branch', authMiddleware(['admin_cabang']), userController.createUser);
router.put('/branch/:id', authMiddleware(['admin_cabang']), userController.updateUser);
router.delete('/branch/:id', authMiddleware(['admin_cabang']), userController.deleteUser);

// Owner Routes
router.get('/owner', authMiddleware(['owner']), cacheMiddleware('users_owner', 300), userController.getUsers);

export default router;