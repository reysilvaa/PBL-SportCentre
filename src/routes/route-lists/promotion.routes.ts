import express from 'express';
import { 
  getPromotions, 
  createPromotion, 
  updatePromotion, 
  deletePromotion 
} from '../../controllers/all/promotion.controller';
import { superAdminAuth, branchAdminAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = express.Router();

router.get('/', cacheMiddleware('promotions', 300), getPromotions);
router.post('/', superAdminAuth, branchAdminAuth, createPromotion);
router.put('/:id', superAdminAuth, branchAdminAuth, updatePromotion);
router.delete('/:id', superAdminAuth, branchAdminAuth, deletePromotion);

export default router;