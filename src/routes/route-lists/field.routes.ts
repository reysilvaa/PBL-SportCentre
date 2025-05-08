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

const router = express.Router();

// Public routes - tidak memerlukan autentikasi
router.get('/', cacheMiddleware('fields', 300), getAllFields);
router.get('/availability', cacheMiddleware('fields_availability', 60), checkAllFieldsAvailability);
router.get('/:id', cacheMiddleware('field_detail', 300), getFieldById);

// Admin routes - memerlukan autentikasi dan permission
router.get(
  '/admin',
  auth({
    allowedRoles: ['admin_cabang', 'owner_cabang', 'super_admin'],
    attachBranch: true,
  }),
  cacheMiddleware('admin_fields', 300),
  getBranchFields,
);

// Pembuatan lapangan - hanya super_admin dan admin_cabang
router.post(
  '/',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang'],
    attachBranch: true,
  }),
  fieldUpload.single('imageUrl'),
  parseIds,
  createField,
);

// Update lapangan
router.put(
  '/:id',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang'],
    attachBranch: true,
    ownerOnly: true,
    resourceName: 'field',
  }),
  fieldUpload.single('imageUrl'),
  parseIds,
  updateField,
);

// Hapus lapangan
router.delete(
  '/:id',
  auth({
    allowedRoles: ['super_admin', 'admin_cabang'],
    attachBranch: true,
    ownerOnly: true,
    resourceName: 'field',
  }),
  deleteField,
);

export default router;
