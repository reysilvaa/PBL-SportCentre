import express from 'express';
import {
  getFieldReviews,
  createFieldReview,
  updateFieldReview,
  deleteFieldReview,
} from '../../controllers/user/fieldReview.controller';
import { parseIds } from '../../middlewares/parseId.middleware';
import { authMiddleware, userAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

router.get('/', cacheMiddleware('field_reviews', 300), getFieldReviews);
router.post('/', userAuth, parseIds, createFieldReview);
router.put('/:id', userAuth, updateFieldReview);
router.delete('/:id', userAuth, deleteFieldReview);

export default router;
