import express from 'express';
import {
  getFieldReviews,
  createFieldReview,
  updateFieldReview,
  deleteFieldReview,
} from '../../controllers/fieldReview.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { auth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

router.get('/', cacheMiddleware('field_reviews', 300), getFieldReviews);

router.post(
  '/',
  auth({
    allowedRoles: ['user'],
  }),
  parseIds,
  createFieldReview,
);

router.put(
  '/:id',
  auth({
    allowedRoles: ['user'],
    ownerOnly: true,
    resourceName: 'fieldReview',
  }),
  updateFieldReview,
);

router.delete(
  '/:id',
  auth({
    allowedRoles: ['user'],
    ownerOnly: true,
    resourceName: 'fieldReview',
  }),
  deleteFieldReview,
);

export default router;
