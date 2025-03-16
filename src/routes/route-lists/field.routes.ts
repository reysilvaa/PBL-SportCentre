import express from 'express';
import { 
  getFields as getAllFields, 
  createField as createAnyField, 
  updateField as updateAnyField, 
  deleteField as deleteAnyField 
} from '../../controllers/all/field.controller';
import { 
  checkAllFieldsAvailability
} from '../../controllers/all/availability.controller';
import { 
  getFields as getAdminFields, 
  getFieldById, 
  createField as createAdminField, 
  updateField as updateAdminField, 
  deleteField as deleteAdminField 
} from '../../controllers/admin/admin_cabang/field.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { parseIds } from '../../middlewares/parseId.middleware';
import { adminBranchMiddleware } from '../../middlewares/adminBranch.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = express.Router();

// Public or general routes
router.get('/', cacheMiddleware('fields', 300), getAllFields);
router.get('/availability', cacheMiddleware('fields_availability', 60), checkAllFieldsAvailability);
router.post('/', authMiddleware(['super_admin']), parseIds, createAnyField);
router.put('/:id', authMiddleware(['super_admin']), parseIds, updateAnyField);
router.delete('/:id', authMiddleware(['super_admin']), deleteAnyField);

// Admin cabang specific routes
router.get('/admin', authMiddleware(['admin_cabang', 'owner_cabang']), adminBranchMiddleware, cacheMiddleware('admin_fields', 300), getAdminFields);
router.get('/admin/:id', authMiddleware(['admin_cabang', 'owner_cabang']), adminBranchMiddleware, cacheMiddleware('admin_field_detail', 300), getFieldById);
router.post('/admin', authMiddleware(['admin_cabang', 'owner_cabang']), adminBranchMiddleware, parseIds, createAdminField);
router.put('/admin/:id', authMiddleware(['admin_cabang', 'owner_cabang']), adminBranchMiddleware, parseIds, updateAdminField);
router.delete('/admin/:id', authMiddleware(['admin_cabang', 'owner_cabang']), adminBranchMiddleware, deleteAdminField);

export default router;