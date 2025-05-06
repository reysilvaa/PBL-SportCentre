import express from 'express';
import {
  getFieldTypes,
  createFieldType,
  updateFieldType,
  deleteFieldType,
} from '../../controllers/all/fieldType.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

// Rute publik yang tidak memerlukan peran spesifik
router.get('/', cacheMiddleware('field_types', 600), getFieldTypes);

// Rute khusus admin
router.post(
  '/',
  authMiddleware(['super_admin']),
  parseIds,
  roleBasedController({
    superAdmin: createFieldType,
  })
);

router.put(
  '/:id',
  authMiddleware(['super_admin']),
  roleBasedController({
    superAdmin: updateFieldType,
  })
);

router.delete(
  '/:id',
  authMiddleware(['super_admin']),
  roleBasedController({
    superAdmin: deleteFieldType,
  })
);

export default router;
