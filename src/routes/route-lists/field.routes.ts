import express from 'express';
import { getFields } from '../../controllers/all/field.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { superAdminAuth, branchAdminAuth, ownerAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { checkAllFieldsAvailability } from '../../controllers/all/availability.controller';
import { 
  getFields as getAdminFields, 
  createField, 
  updateField, 
  deleteField,
  getFieldById
} from '../../controllers/admin/admin_cabang/field.controller';
import { adminBranchMiddleware } from '../../middlewares/adminBranch.middleware';
import { fieldUpload } from '../../middlewares/multer.middleware';

const router = express.Router();

// Public or general access routes
router.get('/', cacheMiddleware('fields', 300), getFields);

// Public or general routes
router.get('/availability', cacheMiddleware('fields_availability', 60), checkAllFieldsAvailability);

// Admin cabang specific routes
router.get('/admin', branchAdminAuth, adminBranchMiddleware, cacheMiddleware('admin_fields', 300), getAdminFields);
router.post('/admin', branchAdminAuth, adminBranchMiddleware, fieldUpload.single('imageUrl'), parseIds, createField);

router.put('/admin/:id', branchAdminAuth, adminBranchMiddleware, fieldUpload.single('imageUrl'), parseIds, updateField);
router.delete('/admin/:id', branchAdminAuth, adminBranchMiddleware, deleteField);

// Owner cabang routes
router.get('/owner', ownerAuth, adminBranchMiddleware, cacheMiddleware('owner_fields', 300), getAdminFields);

// Super Admin routes - menggunakan controller yang sama dengan admin cabang tapi tanpa middleware cabang
router.post('/', superAdminAuth, fieldUpload.single('imageUrl'), parseIds, createField);
router.put('/:id', superAdminAuth, fieldUpload.single('imageUrl'), parseIds, updateField);
router.delete('/:id', superAdminAuth, deleteField);

// Detail field berdasarkan ID - letakkan di bagian akhir untuk menghindari konflik
router.get('/:id', cacheMiddleware('field_detail', 300), getFieldById);

export default router;