import express from 'express';
import { 
  getFieldReviews, 
  createFieldReview, 
  updateFieldReview, 
  deleteFieldReview 
} from '../controllers/fieldReview.controller';

const router = express.Router();

router.get('/', getFieldReviews);
router.post('/', createFieldReview);
router.put('/:id', updateFieldReview);
router.delete('/:id', deleteFieldReview);

export default router;