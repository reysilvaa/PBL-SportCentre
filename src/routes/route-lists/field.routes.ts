import express from 'express';
import { parseIds } from '../../middlewares/parseId.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { fieldUpload } from '../../middlewares/multer.middleware';
import { auth } from '../../middlewares/auth.middleware';
import {
  getAllFields,
  getBranchFields,
  createField,
  updateField,
  deleteField,
  getFieldById,
} from '../../controllers/field.controller';
import { checkAllFieldsAvailability } from '../../controllers/availability.controller';
import { Role } from '../../types';

const router = express.Router();

// Public routes - tidak memerlukan autentikasi
router.get(
  '/', 
  cacheMiddleware('fields', 0), 
  getAllFields
);

router.get(
  '/availability', 
  checkAllFieldsAvailability
);

router.get(
  '/:id', 
  cacheMiddleware('field_detail', 300), 
  getFieldById
);

// Admin routes - memerlukan autentikasi dan permission
router.get(
  '/admin',
  auth({
    allowedRoles: [Role.ADMIN_CABANG, Role.OWNER_CABANG, Role.SUPER_ADMIN],
    attachBranch: true,
  }),
  cacheMiddleware('admin_fields', 300),
  getBranchFields
);

// Pembuatan lapangan - hanya super_admin dan admin_cabang
router.post(
  '/',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG],
    attachBranch: true,
  }),
  fieldUpload.single('imageUrl'),
  parseIds,
  createField
);

// Update lapangan
router.put(
  '/:id',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG],
    attachBranch: true,
    ownerOnly: true,
    resourceName: 'field',
  }),
  fieldUpload.single('imageUrl'),
  parseIds,
  updateField
);

// Hapus lapangan
router.delete(
  '/:id',
  auth({
    allowedRoles: [Role.SUPER_ADMIN, Role.ADMIN_CABANG],
    attachBranch: true,
    ownerOnly: true,
    resourceName: 'field',
  }),
  deleteField
);

export default router;
