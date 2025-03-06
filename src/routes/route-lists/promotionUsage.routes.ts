import express from 'express';
import { 
  getPromotionUsages, 
  createPromotionUsage, 
  deletePromotionUsage 
} from '../../controllers/promotionUsage.controller';

const router = express.Router();

router.get('/', getPromotionUsages);
router.post('/', createPromotionUsage);
router.delete('/:id', deletePromotionUsage);

export default router;
