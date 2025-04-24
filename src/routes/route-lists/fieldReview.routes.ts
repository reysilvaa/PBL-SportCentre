import express from 'express';
import {
  getFieldReviews,
  createFieldReview,
  updateFieldReview,
  deleteFieldReview,
} from '../../controllers/user/fieldReview.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

router.get('/', cacheMiddleware('field_reviews', 300), getFieldReviews);

router.post(
  '/',
  authMiddleware(['user']),
  parseIds,
  roleBasedController({
    user: createFieldReview,
  })
);

router.put(
  '/:id',
  authMiddleware(['user']),
  roleBasedController({
    user: updateFieldReview,
  })
);

router.delete(
  '/:id',
  authMiddleware(['user']),
  roleBasedController({
    user: deleteFieldReview,
  })
);

export default router;
