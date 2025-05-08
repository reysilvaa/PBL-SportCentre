import express from 'express';
import { getFields } from '../../controllers/all/field.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { checkAllFieldsAvailability } from '../../controllers/all/availability.controller';
import {
  getFields as getAdminFields,
  createField,
  updateField,
  deleteField,
  getFieldById,
} from '../../controllers/admin/admin_cabang/field.controller';
import { adminBranchMiddleware } from '../../middlewares/adminBranch.middleware';
import { fieldUpload } from '../../middlewares/multer.middleware';

const router = express.Router();

// Public atau general access routes
router.get('/', cacheMiddleware('fields', 300), getFields);

// Routes untuk memeriksa ketersediaan lapangan
router.get('/availability', cacheMiddleware('fields_availability', 60), checkAllFieldsAvailability);

// Routes untuk admin dan owner
router.get(
  '/admin',
  authMiddleware(['admin_cabang', 'owner_cabang']),
  adminBranchMiddleware,
  cacheMiddleware('admin_fields', 300),
  roleBasedController({
    branchAdmin: getAdminFields,
    owner: getAdminFields,
  })
);

// Pembuatan lapangan - admin atau super admin
router.post(
  '/',
  authMiddleware(['super_admin', 'admin_cabang']),
  fieldUpload.single('imageUrl'),
  parseIds,
  adminBranchMiddleware, /// sementara ... fixing nanti
  roleBasedController({
    superAdmin: createField,
    branchAdmin: createField,
  })
);

// Update lapangan - admin, owner, atau super admin
router.put(
  '/:id',
  authMiddleware(['super_admin', 'admin_cabang']),
  fieldUpload.single('imageUrl'),
  parseIds,
  roleBasedController({
    superAdmin: updateField,
    branchAdmin: updateField,
  })
);

// Hapus lapangan - admin atau super admin
router.delete(
  '/:id',
  authMiddleware(['super_admin', 'admin_cabang']),
  roleBasedController({
    superAdmin: deleteField,
    branchAdmin: deleteField,
  })
);

// Detail lapangan berdasarkan ID - public
router.get('/:id', cacheMiddleware('field_detail', 300), getFieldById);

export default router;
