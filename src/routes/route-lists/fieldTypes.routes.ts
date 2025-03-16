import express from 'express';
import { 
  getFieldTypes, 
  createFieldType, 
  updateFieldType, 
  deleteFieldType 
} from '../../controllers/all/fieldType.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { superAdminAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = express.Router();

// Public routes or routes that don't need specific role
router.get('/', cacheMiddleware('field_types', 600), getFieldTypes);

// Admin only routes
router.post('/', superAdminAuth, parseIds, createFieldType);
router.put('/:id', superAdminAuth, updateFieldType);
router.delete('/:id', superAdminAuth, deleteFieldType);

export default router;