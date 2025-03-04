import express from 'express';
import { 
  getPromotions, 
  createPromotion, 
  updatePromotion, 
  deletePromotion 
} from '../controllers/promotion.controller';

const router = express.Router();

router.get('/', getPromotions);
router.post('/', createPromotion);
router.put('/:id', updatePromotion);
router.delete('/:id', deletePromotion);

export default router;