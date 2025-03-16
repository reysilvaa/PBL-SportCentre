import express from 'express';
import { 
  getFieldTypes, 
  createFieldType, 
  updateFieldType, 
  deleteFieldType 
} from '../../controllers/all/fieldType.controller';

import { parseIds } from '../../middlewares/parseId.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = express.Router();

// Public route - semua pengguna dapat melihat tipe lapangan
router.get('/', cacheMiddleware('field_types', 600), getFieldTypes); // Cache selama 10 menit karena data jarang berubah

// Protected routes - hanya super_admin yang dapat membuat, mengubah, dan menghapus tipe lapangan
router.post('/', authMiddleware(['super_admin']), parseIds, createFieldType);
router.put('/:id', authMiddleware(['super_admin']), updateFieldType);
router.delete('/:id', authMiddleware(['super_admin']), deleteFieldType);

export default router;