import express from 'express';
import { 
  getFieldReviews, 
  createFieldReview, 
  updateFieldReview, 
  deleteFieldReview 
} from '../../controllers/fieldReview.controller';
import { parseIds } from '../../middlewares/parseId.middleware';

const router = express.Router();

router.get('/', getFieldReviews);
router.post('/', parseIds, createFieldReview);
router.put('/:id', updateFieldReview);
router.delete('/:id', deleteFieldReview);

export default router;