import express from 'express';
import {
  getFieldTypes,
  createFieldType,
  updateFieldType,
  deleteFieldType,
  getFieldTypeById,
} from '../../controllers/fieldType.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { auth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

// Rute publik yang tidak memerlukan peran spesifik
router.get('/', cacheMiddleware('field_types', 600), getFieldTypes);
router.get('/:id', cacheMiddleware('field_types', 600), getFieldTypeById);

// Rute khusus admin
router.post(
  '/',
  auth({
    allowedRoles: ['super_admin'],
  }),
  parseIds,
  createFieldType
);

router.put(
  '/:id',
  auth({
    allowedRoles: ['super_admin'],
  }),
  updateFieldType
);

router.delete(
  '/:id',
  auth({
    allowedRoles: ['super_admin'],
  }),
  deleteFieldType
);

export default router;
