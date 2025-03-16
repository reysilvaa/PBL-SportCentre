import express from 'express';
import { 
  getPromotions, 
  createPromotion, 
  updatePromotion, 
  deletePromotion 
} from '../../controllers/all/promotion.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = express.Router();

router.get('/', cacheMiddleware('promotions', 300), getPromotions);
router.post('/', authMiddleware(['super_admin', 'admin_cabang']), createPromotion);
router.put('/:id', authMiddleware(['super_admin', 'admin_cabang']), updatePromotion);
router.delete('/:id', authMiddleware(['super_admin', 'admin_cabang']), deletePromotion);

export default router;