import express from 'express';
import userRoutes from './route-lists/user.routes';
import branchRoutes from './route-lists/branch.routes';
import fieldRoutes from './route-lists/field.routes';
import bookingRoutes from './route-lists/booking.routes';
import fieldTypeRoutes from './route-lists/fieldTypes.routes';
// import paymentRoutes from './route-lists/payment.routes';
import activityLogRoutes from './route-lists/activityLog.routes';
import fieldReviewRoutes from './route-lists/fieldReview.routes';
import promotionRoutes from './route-lists/promotion.routes';
import promotionUsageRoutes from './route-lists/promotionUsage.routes';
import authRoutes from './route-lists/auth.routes';
import webhookRoutes from './route-lists/webhook.routes';
import cache, { getCacheStats } from '../utils/cache';
import { authMiddleware } from '../middlewares/auth.middleware';
    
const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/fields', fieldRoutes);
router.use('/bookings', bookingRoutes);
router.use('/field-types', fieldTypeRoutes);
// router.use('/payments', paymentRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/field-reviews', fieldReviewRoutes);
router.use('/promotions', promotionRoutes);
router.use('/promotion-usages', promotionUsageRoutes);
router.use('/webhooks', webhookRoutes);

// Endpoint untuk health check dan monitoring
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Service is running' });
});

// Endpoint untuk statistik cache (admin only)
router.get('/cache-stats', authMiddleware(['super_admin']), (req, res) => {
  try {
    const stats = getCacheStats();
    const pattern = req.query.pattern as string;
    
    let keys: string[] = [];
    if (pattern) {
      keys = cache.keys().filter(key => key.includes(pattern));
    }
    
    res.json({
      stats,
      keys: pattern ? keys : undefined,
      keysCount: pattern ? keys.length : undefined
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get cache statistics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;